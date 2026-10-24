// -----------------------------------------------------------------------------
// The monitor against the fake Gladys and the fake Brottsplatskartan: the
// devices of the zones, their states, the scene trigger, the restarts and the
// changes of configuration, the container's own timer.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSE,
  KRONOBERG_DUI,
  MALMO_FIRE,
  SOLNA_OTHER,
  START,
  STOCKHOLM_SHOOTING,
  createAll,
  createApi,
  createClock,
  createWorld,
  cycle,
  featureId,
  lastState,
} from './helpers/world.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

async function world(t, config = {}, options = {}) {
  const w = await createWorld({ config, ...options });
  t.after(() => w.app.stop());
  return w;
}

const deviceOf = (w, zone) =>
  w.fake.discoveredDevices.find((device) => device.external_id.endsWith(`:${zone}`));

test('by default, one device: the 10 km around the house', async (t) => {
  const w = await world(t);
  const devices = w.fake.discoveredDevices;
  assert.equal(devices.length, 1);
  assert.match(devices[0].external_id, /:zone:radius$/);
  assert.equal(devices[0].name, 'Interventions de police près de chez moi');
  assert.equal(devices[0].should_poll, false);
  assert.equal(devices[0].features.length, 9);
});

test('a county or places add the area device; radius off removes the other', async (t) => {
  const both = await world(t, { county: 'skane' });
  assert.deepEqual(
    both.fake.discoveredDevices.map((device) => device.external_id.split(':').at(-1)),
    ['radius', 'area'],
  );
  const area = deviceOf(both, 'area');
  assert.ok(!area.features.some((feature) => feature.external_id.endsWith(':latest_distance')));
  const placesOnly = await world(t, { radius: '0', places: 'Solna' });
  assert.deepEqual(
    placesOnly.fake.discoveredDevices.map((device) => device.external_id.split(':').at(-1)),
    ['area'],
  );
});

test('states of the radius zone: the last 24 hours around Stockholm', async (t) => {
  const w = await world(t);
  assert.deepEqual(w.fake.states, [], 'nothing published before the device exists');
  const [device] = await createAll(w);
  const state = (key) => lastState(w, featureId(device, key));
  // Övrigt in Solna (5.9 km) and Skottlossning in Stockholm (7.1 km).
  assert.equal(state('events_24h'), 2);
  assert.equal(state('violence_24h'), 1);
  assert.equal(state('other_24h'), 1);
  assert.equal(state('burglary_24h'), 0);
  assert.equal(state('fire_24h'), 0);
  assert.equal(state('latest_event'), 'Autre (Övrigt) · Solna · 24/10 09:38 · 5,9 km');
  assert.equal(state('latest_distance'), 5.9);
  assert.deepEqual(
    w.monitor.events.map((event) => event.id),
    [SOLNA_OTHER, STOCKHOLM_SHOOTING],
  );
});

test('the area zone: a county, places (accents optional), county-level events included', async (t) => {
  const w = await world(t, { radius: '0', county: 'kronoberg', places: 'malmo' });
  const [device] = await createAll(w);
  const ids = w.monitor.zoneEvents.area.map((event) => event.id);
  assert.ok(ids.includes(KRONOBERG_DUI), 'located by its county only');
  assert.ok(ids.includes(MALMO_FIRE), 'Malmö, typed without its accent');
  assert.ok(
    w.monitor.zoneEvents.area.every((e) => e.county === 'kronoberg' || /Malmö/.test(e.location)),
  );
  assert.equal(lastState(w, featureId(device, 'events_24h')), ids.length);
});

test('a county-level event is never in the radius zone, even at the county centre', async (t) => {
  const api = createApi();
  const w = await world(t, {}, { api });
  await createAll(w);
  api.addEvent(KRONOBERG_DUI, {
    time: START + 10 * MINUTE,
    lat: HOUSE.latitude,
    lng: HOUSE.longitude,
    place: 'Stockholms län',
    county: 'Stockholms län',
  });
  await cycle(w);
  assert.equal(w.fake.sceneEvents.length, 0);
  assert.equal(w.monitor.zoneEvents.radius.length, 2);
});

test('the first start fires nothing: what is listed is not news', async (t) => {
  const w = await world(t, { county: 'stockholm' });
  await cycle(w);
  assert.deepEqual(w.fake.sceneEvents, []);
});

test('a new event near home fires the trigger, with its variables', async (t) => {
  const api = createApi();
  const w = await world(t, { county: 'skane' }, { api });
  const [device] = await createAll(w);
  const id = api.addEvent(SOLNA_OTHER, {
    time: START + 5 * MINUTE,
    type: 'Inbrott',
    lat: 59.3326,
    lng: 18.0649,
    place: 'Stockholm',
    location: 'Norrmalm, Stockholm, Stockholms län',
  });
  await cycle(w);
  assert.equal(w.fake.sceneEvents.length, 1);
  const [{ key, data }] = w.fake.sceneEvents;
  assert.equal(key, 'new_event');
  assert.equal(data.zone, 'radius');
  assert.equal(data.category, 'burglary');
  assert.equal(data.zone_name, 'Près de chez moi');
  assert.equal(data.category_name, 'Cambriolage');
  assert.equal(data.type, 'Inbrott');
  assert.equal(data.type_name, 'Cambriolage (Inbrott)');
  assert.equal(data.place, 'Stockholm');
  assert.equal(data.distance_km, 0.4);
  assert.equal(data.time, new Date(START + 5 * MINUTE).toISOString());
  assert.match(data.summary, /^Cambriolage \(Inbrott\) · Stockholm · 24\/10 11:30 · 0,4 km$/);
  assert.match(data.url, /^https:\/\/brottsplatskartan\.se\//);
  assert.equal(lastState(w, featureId(device, 'burglary_24h')), 1);
  assert.equal(lastState(w, featureId(device, 'events_24h')), 3);
  assert.equal(w.monitor.events[0].id, id);
});

test('an event in both zones fires once per zone; elsewhere, nothing', async (t) => {
  const api = createApi();
  const w = await world(t, { county: 'stockholm' }, { api });
  api.addEvent(SOLNA_OTHER, { time: START + MINUTE });
  api.addEvent(MALMO_FIRE, { time: START + MINUTE });
  await cycle(w);
  assert.deepEqual(
    w.fake.sceneEvents.map((event) => event.data.zone),
    ['radius', 'area'],
  );
});

test('an event published long ago and listed late is not news', async (t) => {
  const api = createApi();
  const w = await world(t, {}, { api });
  api.addEvent(SOLNA_OTHER, { time: START - 5 * HOUR });
  await cycle(w);
  assert.deepEqual(w.fake.sceneEvents, []);
  assert.equal(w.monitor.zoneEvents.radius.length, 3, 'counted all the same');
});

test('the counters slide with the 24-hour window, the latest event stays', async (t) => {
  const w = await world(t);
  const [device] = await createAll(w);
  // 17:40 on 23/10 leaves the window at 17:40 on 24/10 (15:40 UTC).
  w.clock.time = Date.parse('2026-10-24T15:45:00Z');
  await w.monitor.runCycle();
  assert.equal(lastState(w, featureId(device, 'events_24h')), 1);
  assert.equal(lastState(w, featureId(device, 'violence_24h')), 0);
  w.clock.time = Date.parse('2026-10-25T08:00:00Z');
  await w.monitor.runCycle();
  assert.equal(lastState(w, featureId(device, 'events_24h')), 0);
  assert.match(lastState(w, featureId(device, 'latest_event')), /^Autre \(Övrigt\) · Solna/);
});

test('the next readings ask only for the new events', async (t) => {
  const api = createApi();
  const w = await world(t, {}, { api });
  assert.equal(api.requests.length, 1);
  assert.equal(api.requests[0].searchParams.get('limit'), '100');
  await cycle(w);
  assert.equal(api.requests.length, 2);
  assert.equal(api.requests[1].searchParams.get('limit'), '30');
});

test('a restart reads what is new, fires only for it, and keeps the history', async (t) => {
  const api = createApi();
  const clock = createClock();
  const first = await createWorld({ api, clock });
  await first.app.stop();
  api.addEvent(SOLNA_OTHER, { time: START + 20 * MINUTE });
  clock.advance(30 * MINUTE);
  const second = await world(t, {}, { api, clock, dataDir: first.dataDir });
  assert.equal(second.fake.sceneEvents.length, 1);
  assert.equal(second.monitor.zoneEvents.radius.length, 3);
  assert.equal(api.requests.at(-1).searchParams.get('limit'), '30');
});

test('a change of configuration brings no false news, and new devices', async (t) => {
  const w = await world(t);
  await w.fake.configUpdated({ radius: '50', county: 'skane', language: 'en' });
  assert.deepEqual(w.fake.sceneEvents, []);
  const names = w.fake.discoveredDevices.map((device) => device.name);
  assert.deepEqual(names, ['Police events near home', 'Police events in my area']);
  assert.ok(w.monitor.zoneEvents.radius.length > 2);
});

test('no centre: a status says so, and the area zone still works', async (t) => {
  const w = await world(t, { places: 'Solna' }, { houses: [] });
  assert.match(w.fake.connectionStatus.message.en, /No centre for the radius/);
  assert.equal(w.monitor.zoneEvents.radius.length, 0);
  assert.ok(w.monitor.zoneEvents.area.some((event) => event.id === SOLNA_OTHER));
});

test('Brottsplatskartan down: disconnected with a message, back when it answers', async (t) => {
  const api = createApi();
  const w = await world(t, {}, { api });
  assert.equal(w.fake.connectionStatus.connected, true);
  api.down = 503;
  await cycle(w);
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.fr, /Brottsplatskartan ne répond pas/);
  api.down = false;
  await cycle(w);
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('the container reads on its own timer, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const api = createApi();
  const w = await world(t, { refresh_interval: '10' }, { api, timers: true });
  const before = api.requests.length;
  t.mock.timers.tick(10 * MINUTE);
  await w.monitor.running;
  assert.equal(api.requests.length, before + 1);
});

test('onPoll is only a fallback: no new reading within half an interval', async (t) => {
  const api = createApi();
  const w = await world(t, {}, { api });
  const [device] = await createAll(w);
  const before = api.requests.length;
  await w.fake.poll(device);
  assert.equal(api.requests.length, before);
  w.clock.advance(8 * MINUTE);
  await w.fake.poll(device);
  assert.equal(api.requests.length, before + 1);
});

test('creating a device publishes everything at once and nudges the widget', async (t) => {
  const w = await world(t, { county: 'skane' });
  const refreshes = w.fake.widgetRefreshes.length;
  w.clock.advance(20 * 1000);
  const devices = await createAll(w);
  for (const device of devices) {
    for (const feature of device.features.filter((f) => !f.external_id.endsWith('distance'))) {
      assert.notEqual(lastState(w, feature.external_id), undefined, feature.name);
    }
  }
  assert.ok(w.fake.widgetRefreshes.length > refreshes);
});
