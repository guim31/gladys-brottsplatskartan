// -----------------------------------------------------------------------------
// The `events` widget and the two actions: contents within the core budget
// (validateWidgetContent: an empty array means rendered as sent), the order of
// the events, the texts of every language, and the sentence of the scene
// action and of the configuration action.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from '../src/config.js';
import { MAX_ITEMS } from '../src/widgets.js';
import { SOLNA_OTHER, START, createApi, createWorld } from './helpers/world.js';

async function world(t, config = {}, options = {}) {
  const w = await createWorld({ config, ...options });
  t.after(() => w.app.stop());
  return w;
}

const content = async (w, language) =>
  (await w.fake.widgetGet('events', { settings: {}, language })).data.content;

test('the widget lists the events, newest first, within the budget', async (t) => {
  const w = await world(t);
  for (const language of LANGUAGES) {
    const widget = await content(w, language);
    assert.deepEqual(validateWidgetContent(widget), [], language);
    const list = widget.components.find((c) => c.type === 'card-list');
    assert.equal(list.items.length, 2);
    assert.equal(list.items[1].badge.color, 'danger');
    assert.equal(
      list.items[0].links[0].url,
      'https://brottsplatskartan.se/stockholm/ovrigt-solna-mall-of-scandinavia-512247',
    );
  }
  const fr = await content(w, 'fr');
  assert.equal(fr.components[0].text, '2 événements en 24 h');
  const [first, second] = fr.components.find((c) => c.type === 'card-list').items;
  assert.equal(first.title, 'Autre (Övrigt)');
  assert.equal(first.subtitle, 'Solna · 24/10 09:38 · 5,9 km');
  assert.equal(second.title, 'Coups de feu (Skottlossning)');
  assert.equal(second.badge.text, 'Violence');
  assert.match(first.description, /^Polis på plats i Mall of Scandinavia/);
  assert.match(
    fr.components.find((c) => c.variant === 'caption').text,
    /^Source : Brottsplatskartan · 24\/10 11:25$/,
  );
});

test('more events than rows: the heading says how many are shown', async (t) => {
  const api = createApi();
  for (let i = 0; i < 10; i += 1) {
    api.addEvent(SOLNA_OTHER, { time: START - i * 60 * 1000 });
  }
  const w = await world(t, {}, { api });
  const widget = await content(w, 'en');
  assert.deepEqual(validateWidgetContent(widget), []);
  assert.equal(widget.components[0].text, `12 events in 24 hours (${MAX_ITEMS} shown)`);
  assert.equal(widget.components.find((c) => c.type === 'card-list').items.length, MAX_ITEMS);
});

test('badges fit in every language and category', async (t) => {
  const w = await world(t, { radius: '0', county: 'skane', places: 'Stockholm, Göteborg' });
  for (const language of LANGUAGES) {
    assert.deepEqual(validateWidgetContent(await content(w, language)), [], language);
  }
});

test('no event, and Brottsplatskartan never reached: a heading, no empty list', async (t) => {
  const quiet = await world(t, { radius: '0' });
  const none = await content(quiet, 'de');
  assert.deepEqual(validateWidgetContent(none), []);
  assert.equal(none.components[0].text, 'Kein Ereignis in 24 h');
  assert.ok(!none.components.some((c) => c.type === 'card-list'));

  const api = createApi();
  api.down = 'network';
  const down = await world(t, {}, { api });
  const waiting = await content(down, 'es');
  assert.deepEqual(validateWidgetContent(waiting), []);
  assert.equal(waiting.components[0].text, 'Esperando los sucesos…');
});

test('read_events: one sentence and the count', async (t) => {
  const w = await world(t, { language: 'en' });
  const { success, data } = await w.fake.sceneAction('read_events', {});
  assert.equal(success, true);
  assert.equal(data.outputs.count, 2);
  assert.equal(
    data.outputs.text,
    '2 police events in 24 hours: Other (Övrigt) in Solna, 09:38, 5.9 km away; Shooting (Skottlossning) in Stockholm, 17:40, 7.1 km away.',
  );
  const quiet = await world(t, { radius: '0', language: 'fr' });
  const none = await quiet.fake.sceneAction('read_events', {});
  assert.deepEqual(none.data.outputs, {
    text: 'Aucun événement de police dans votre zone ces dernières 24 heures.',
    count: 0,
  });
});

test('read_events reads again when the last cycle is old, and fails if it never answered', async (t) => {
  const api = createApi();
  const w = await world(t, {}, { api });
  const before = api.requests.length;
  await w.fake.sceneAction('read_events', {});
  assert.equal(api.requests.length, before);
  w.clock.advance(16 * 60 * 1000);
  api.addEvent(SOLNA_OTHER, { time: START + 10 * 60 * 1000 });
  const { data } = await w.fake.sceneAction('read_events', {});
  assert.equal(api.requests.length, before + 1);
  assert.equal(data.outputs.count, 3);

  const downApi = createApi();
  downApi.down = 503;
  const down = await world(t, {}, { api: downApi });
  const failed = await down.fake.sceneAction('read_events', {});
  assert.equal(failed.success, false);
  assert.match(failed.error, /Brottsplatskartan ne répond pas/);
});

test('check_now answers in the four languages, within a toast', async (t) => {
  const w = await world(t, { radius: '0', county: 'stockholm' });
  const { data } = await w.fake.action('check_now', {});
  assert.deepEqual(Object.keys(data.message), LANGUAGES);
  for (const language of LANGUAGES) {
    assert.ok(data.message[language].length <= 200, `${language}: ${data.message[language]}`);
  }
  assert.match(
    data.message.fr,
    /^\d+ événements de police en 24 heures : .* et \d+ de plus\. Vérifié à 11:25\.$/,
  );
});
