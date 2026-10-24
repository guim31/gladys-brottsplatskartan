// -----------------------------------------------------------------------------
// Brottsplatskartan client: the newest police events of all of Sweden, from
// `GET /api/events` (newest first, paged, ids increasing with time), as plain
// objects. Filtering by zone is done here, in the container: the API filters
// by county or by place but not by distance, and one national reading serves
// every zone.
//
// Terms (brottsplatskartan.se/sida/api, 24/10/2026): free for non-commercial
// use, a unique `app` parameter on every call, 500 calls a minute at most,
// answers cached 2 to 5 minutes, a link back to the event (`permalink`)
// welcome. One reading every 10 to 30 minutes, of the new events only.
// The service is public and keyless: no header carries a secret.
// -----------------------------------------------------------------------------

import { COUNTIES, fold } from './config.js';
import { categoryOf, cleanType } from './types.js';

export const API_URL = 'https://brottsplatskartan.se/api/events';
export const SITE_URL = 'https://brottsplatskartan.se';
export const APP_ID = 'gladys-assistant';
export const USER_AGENT =
  'gladys-brottsplatskartan (Gladys Assistant integration; +https://github.com/guim31/gladys-brottsplatskartan)';

// Events per page: the first reading goes back a day (about 100 events for all
// of Sweden), the next ones read only what is new (a few events).
export const FIRST_PAGE_SIZE = 100;
export const PAGE_SIZE = 30;
export const MAX_PAGES = 5;

export class HttpError extends Error {
  /**
   * @param {string} message
   * @param {number|null} status HTTP status, null for a network error or a bad body
   */
  constructor(message, status = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** GET `url` and parse its JSON body. */
export async function getJson(fetchImpl, url, { timeoutMs = 30000 } = {}) {
  const host = new URL(url).host;
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const reason =
      err?.name === 'TimeoutError' ? `no answer in ${timeoutMs / 1000} s` : err.message;
    throw new HttpError(`${host}: ${reason}`);
  }
  if (response.status !== 200) {
    throw new HttpError(`${host}: HTTP ${response.status}`, response.status);
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(`${host}: the answer is not JSON`, response.status);
  }
}

/** The URL of one page of the national list. */
export function eventsUrl({ page, limit }) {
  const params = new URLSearchParams({ app: APP_ID, limit: String(limit), page: String(page) });
  return `${API_URL}?${params}`;
}

const text = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/** The county key of a Brottsplatskartan county name, or null. */
export function countyKeyOf(name) {
  const folded = fold(name);
  if (!folded) {
    return null;
  }
  const county = COUNTIES.find((entry) =>
    [entry.name, ...(entry.aliases ?? [])].some((alias) => fold(alias) === folded),
  );
  return county?.key ?? null;
}

/**
 * One event of the list as a plain event, or null when it is not usable (no
 * id, no date, or a summary of several events).
 */
export function parseEvent(raw) {
  if (!raw || typeof raw !== 'object' || !Number.isInteger(Number(raw.id))) {
    return null;
  }
  const type = cleanType(raw.title_type);
  const category = categoryOf(type);
  const time = Date.parse(raw.pubdate_iso8601);
  if (!type || category === null || !Number.isFinite(time)) {
    return null;
  }
  const latitude = Number(raw.lat);
  const longitude = Number(raw.lng);
  const located =
    Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0);
  const place = text(raw.title_location);
  // The parts of "Mall Of Scandinavia, Solna, Stockholms län": the places an
  // area zone can name.
  const places = text(raw.location_string)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const countyName = text(raw.administrative_area_level_1);
  return {
    id: Number(raw.id),
    time,
    type,
    category,
    place,
    location: text(raw.location_string),
    places: [...new Set([place, ...places].filter(Boolean))],
    county: countyKeyOf(countyName),
    countyName,
    // An event the police locates only by its county ("Stockholms län") sits
    // at the centre of the county: no distance means anything for it.
    precise: located && !/ län$/i.test(place),
    latitude: located ? latitude : null,
    longitude: located ? longitude : null,
    headline: text(raw.headline),
    description: text(raw.description),
    url:
      typeof raw.permalink === 'string' && raw.permalink.startsWith('https://')
        ? raw.permalink
        : SITE_URL,
  };
}

/**
 * The events newer than `afterId` (all of them from the last `since` ms when
 * `afterId` is 0), newest first. Pages are read until a known id, an event
 * older than `since`, or MAX_PAGES. `truncated` says the cap was reached.
 */
export async function fetchNewEvents(fetchImpl, { afterId = 0, since }) {
  const limit = afterId > 0 ? PAGE_SIZE : FIRST_PAGE_SIZE;
  const events = [];
  let newestId = afterId;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const body = await getJson(fetchImpl, eventsUrl({ page, limit }));
    if (!Array.isArray(body?.data)) {
      throw new HttpError('brottsplatskartan.se: unexpected answer');
    }
    let done = body.data.length < limit;
    for (const raw of body.data) {
      const id = Number(raw?.id);
      const time = Date.parse(raw?.pubdate_iso8601);
      newestId = Number.isInteger(id) ? Math.max(newestId, id) : newestId;
      if (Number.isInteger(id) && id <= afterId) {
        done = true;
        continue;
      }
      if (Number.isFinite(time) && time < since) {
        done = true;
        continue;
      }
      const event = parseEvent(raw);
      if (event) {
        events.push(event);
      }
    }
    if (done) {
      return { events, newestId, truncated: false };
    }
  }
  return { events, newestId, truncated: true };
}
