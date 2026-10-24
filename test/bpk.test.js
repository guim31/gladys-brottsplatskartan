// -----------------------------------------------------------------------------
// The Brottsplatskartan client on the recorded events: parsing, the county and
// precision of an event, the paging of the first and of the next readings, and
// the answers of a service in trouble.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRST_PAGE_SIZE,
  HttpError,
  MAX_PAGES,
  PAGE_SIZE,
  countyKeyOf,
  eventsUrl,
  fetchNewEvents,
  getJson,
  parseEvent,
} from '../src/bpk.js';
import {
  KRONOBERG_DUI,
  NIGHT_SUMMARY,
  SOLNA_OTHER,
  START,
  createApi,
  fixture,
} from './helpers/world.js';

const recorded = fixture('brottsplatskartan/events-2026-10-24.json').data;
const raw = (id) => recorded.find((event) => event.id === id);
const DAY = 24 * 60 * 60 * 1000;

test('a full event of the API parses: type, place, county, position, link', () => {
  const event = parseEvent(fixture('brottsplatskartan/event-full.json'));
  assert.equal(event.id, SOLNA_OTHER);
  assert.equal(event.time, Date.parse('2026-10-24T07:38:01Z'));
  assert.equal(event.type, 'Övrigt');
  assert.equal(event.category, 'other');
  assert.equal(event.place, 'Solna');
  assert.deepEqual(event.places, ['Solna', 'Mall Of Scandinavia', 'Stockholms län']);
  assert.equal(event.county, 'stockholm');
  assert.equal(event.precise, true);
  assert.deepEqual([event.latitude, event.longitude], [59.3703277, 18.0033424]);
  assert.match(event.headline, /^Polis på plats i Mall of Scandinavia/);
  assert.equal(
    event.url,
    'https://brottsplatskartan.se/stockholm/ovrigt-solna-mall-of-scandinavia-512247',
  );
});

test('every recorded event parses, except the summaries of a night', () => {
  const events = recorded.map(parseEvent);
  const summaries = recorded.filter((event) => event.title_type.startsWith('Sammanfattning'));
  assert.ok(summaries.length > 10);
  assert.equal(events.filter((event) => event === null).length, summaries.length);
  assert.equal(parseEvent(raw(NIGHT_SUMMARY)), null);
  assert.ok(events.filter(Boolean).every((event) => event.county !== null));
});

test('an event located by its county only has no meaningful position', () => {
  const event = parseEvent(raw(KRONOBERG_DUI));
  assert.equal(event.place, 'Kronobergs län');
  assert.equal(event.precise, false);
  assert.equal(event.county, 'kronoberg');
});

test('double spaces of the police types are cleaned', () => {
  const event = parseEvent({ ...raw(SOLNA_OTHER), title_type: 'Trafikolycka,  personskada' });
  assert.equal(event.type, 'Trafikolycka, personskada');
  assert.equal(event.category, 'traffic_accident');
});

test('unusable events are dropped; a link that is not https falls back on the site', () => {
  const base = raw(SOLNA_OTHER);
  assert.equal(parseEvent(null), null);
  assert.equal(parseEvent({ ...base, id: 'x' }), null);
  assert.equal(parseEvent({ ...base, pubdate_iso8601: 'yesterday' }), null);
  assert.equal(parseEvent({ ...base, title_type: '' }), null);
  assert.equal(
    parseEvent({ ...base, permalink: 'javascript:alert(1)' }).url,
    'https://brottsplatskartan.se',
  );
  const unlocated = parseEvent({ ...base, lat: null, lng: null });
  assert.equal(unlocated.precise, false);
  assert.equal(unlocated.latitude, null);
});

test('county names, with the variants seen in the data', () => {
  assert.equal(countyKeyOf('Skåne län'), 'skane');
  assert.equal(countyKeyOf('Skåne County'), 'skane');
  assert.equal(countyKeyOf('Västra Götaland'), 'vastra_gotaland');
  assert.equal(countyKeyOf('orebro lan'), 'orebro');
  assert.equal(countyKeyOf('Oslo'), null);
  assert.equal(countyKeyOf(null), null);
});

test('the URL names the application, as the terms of the API ask', () => {
  const url = new URL(eventsUrl({ page: 2, limit: 30 }));
  assert.equal(url.origin + url.pathname, 'https://brottsplatskartan.se/api/events');
  assert.equal(url.searchParams.get('app'), 'gladys-assistant');
  assert.equal(url.searchParams.get('limit'), '30');
  assert.equal(url.searchParams.get('page'), '2');
});

test('first reading: pages of 100 back to 24 hours, summaries left out', async () => {
  const api = createApi();
  const { events, newestId, truncated } = await fetchNewEvents(api.fetch, { since: START - DAY });
  assert.equal(truncated, false);
  assert.equal(newestId, 512248);
  assert.equal(api.requests.length, 1);
  assert.equal(api.requests[0].searchParams.get('limit'), String(FIRST_PAGE_SIZE));
  assert.ok(events.every((event) => event.time >= START - DAY));
  assert.ok(events.length > 40, `${events.length} events`);
  assert.ok(!events.some((event) => event.type.startsWith('Sammanfattning')));
});

test('next readings: one small page, the new events only', async () => {
  const api = createApi();
  const added = api.addEvent(SOLNA_OTHER, { time: START });
  const { events, newestId } = await fetchNewEvents(api.fetch, {
    afterId: 512248,
    since: START - 3 * DAY,
  });
  assert.deepEqual(
    events.map((event) => event.id),
    [added],
  );
  assert.equal(newestId, added);
  assert.equal(api.requests.length, 1);
  assert.equal(api.requests[0].searchParams.get('limit'), String(PAGE_SIZE));
});

test('a long gap reads several pages, up to the cap', async () => {
  const api = createApi();
  for (let i = 0; i < PAGE_SIZE * (MAX_PAGES + 1); i += 1) {
    api.addEvent(SOLNA_OTHER, { time: START });
  }
  const { events, truncated } = await fetchNewEvents(api.fetch, {
    afterId: 512248,
    since: START - 3 * DAY,
  });
  assert.equal(truncated, true);
  assert.equal(api.requests.length, MAX_PAGES);
  assert.equal(events.length, PAGE_SIZE * MAX_PAGES);
});

test('a service in trouble: HTTP status, network error, not JSON, unexpected body', async () => {
  const api = createApi();
  api.down = 503;
  await assert.rejects(fetchNewEvents(api.fetch, { since: 0 }), {
    name: 'HttpError',
    message: 'brottsplatskartan.se: HTTP 503',
    status: 503,
  });
  api.down = 'network';
  await assert.rejects(fetchNewEvents(api.fetch, { since: 0 }), /fetch failed/);
  const html = async () => ({ status: 200, text: async () => '<html>' });
  await assert.rejects(getJson(html, 'https://brottsplatskartan.se/api/events'), HttpError);
  const odd = async () => ({ status: 200, text: async () => '{"error":"x"}' });
  await assert.rejects(fetchNewEvents(odd, { since: 0 }), /unexpected answer/);
  const slow = async () => {
    const err = new Error('timeout');
    err.name = 'TimeoutError';
    throw err;
  };
  await assert.rejects(
    getJson(slow, 'https://brottsplatskartan.se/api/events'),
    /no answer in 30 s/,
  );
});
