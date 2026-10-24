// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake Brottsplatskartan
// serving the recorded events of test/fixtures (paged the way the real API
// does, newest first), a manual clock, a temporary /data, and the integration
// wired on top through registerHandlers. Nothing touches the network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';

process.env.LOG_LEVEL ??= 'silent';
process.env.TZ = 'Europe/Stockholm';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

// The events were recorded on 24/10/2026 around 09:23 UTC (11:23 in Sweden).
export const START = Date.parse('2026-10-24T09:25:00Z');

// A house in the centre of Stockholm (public coordinates of Sergels torg).
export const HOUSE = {
  id: 'house-1',
  name: 'Hemma',
  selector: 'hemma',
  latitude: 59.3293,
  longitude: 18.0686,
};

// Recorded events used by the tests.
export const SOLNA_OTHER = 512247; // Övrigt, Solna, 24/10 09:38, 5.9 km from the house
export const STOCKHOLM_SHOOTING = 512212; // Skottlossning, Stockholm, 23/10 17:40, 7.1 km
export const MALMO_FIRE = 512246; // Brand, Malmö, 24/10 09:00
export const KRONOBERG_DUI = 512237; // Rattfylleri located by its county only
export const NIGHT_SUMMARY = 512245; // Sammanfattning natt, Jämtlands län: left out

/** Fake Brottsplatskartan. `api.down`: 'network', a status (503) or false. */
export function createApi() {
  const recorded = fixture('brottsplatskartan/events-2026-10-24.json');
  const api = {
    events: structuredClone(recorded.data),
    down: false,
    requests: [],

    event(id) {
      return api.events.find((event) => event.id === id);
    },

    /**
     * A new event, copied from a recorded one, with a new id (above every
     * other), published at `time` (ms) and optionally moved or retyped.
     */
    addEvent(fromId, { time, type, lat, lng, place, location, county } = {}) {
      const event = structuredClone(api.event(fromId));
      event.id = Math.max(...api.events.map((e) => e.id)) + 1;
      if (time !== undefined) {
        event.pubdate_iso8601 = new Date(time).toISOString().replace('.000Z', '+00:00');
        event.pubdate_unix = String(Math.floor(time / 1000));
      }
      if (type) {
        event.title_type = type;
      }
      if (lat !== undefined) {
        event.lat = lat;
        event.lng = lng;
      }
      if (place) {
        event.title_location = place;
      }
      if (location) {
        event.location_string = location;
      }
      if (county) {
        event.administrative_area_level_1 = county;
      }
      api.events.unshift(event);
      return event.id;
    },

    async fetch(input) {
      const url = new URL(input);
      api.requests.push(url);
      if (api.down === 'network') {
        throw new TypeError('fetch failed');
      }
      if (api.down) {
        return { status: api.down, text: async () => 'Service Unavailable' };
      }
      if (url.pathname !== '/api/events' || url.searchParams.get('app') !== 'gladys-assistant') {
        return { status: 404, text: async () => 'Not Found' };
      }
      const limit = Number(url.searchParams.get('limit'));
      const page = Number(url.searchParams.get('page'));
      const sorted = [...api.events].sort((a, b) => b.id - a.id);
      const data = sorted.slice((page - 1) * limit, page * limit);
      const body = { links: { current_page: page, per_page: limit, total: sorted.length }, data };
      return { status: 200, text: async () => JSON.stringify(body) };
    },
  };
  return api;
}

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {Array} [options.houses] houses of Gladys
 * @param {object} [options.api] from createApi
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers] true: the monitor's own timer runs (mock it)
 */
export async function createWorld({
  config = {},
  devices = [],
  houses = [HOUSE],
  api = createApi(),
  connect = true,
  timers = false,
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-brottsplatskartan-')),
} = {}) {
  const gladys = createFakeGladys({ config, devices, houses });
  const store = new Store(dataDir);
  const app = registerHandlers(gladys, { store, fetch: api.fetch, timers, now: clock.now });
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.monitor.running;
  }
  return { gladys, fake: gladys.fake, app, monitor: app.monitor, api, clock, store, dataDir };
}

/** Create every discovered device in Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.fake.discoveredDevices) {
    await world.fake.deviceCreated(device);
  }
  return world.fake.discoveredDevices;
}

/** External id of one feature of a device. */
export const featureId = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`))?.external_id;

/** The last state published on a feature (number or text). */
export function lastState(world, externalId) {
  const state = world.fake.states.findLast((s) => s.device_feature_external_id === externalId);
  return state === undefined ? undefined : (state.text ?? state.state);
}

/** Run one refresh cycle, `minutes` later. */
export async function cycle(world, minutes = 15) {
  world.clock.advance(minutes * 60 * 1000);
  await world.monitor.runCycle();
}

/**
 * Capture the integration's log lines at `level` and above (LOG_LEVEL is read
 * at every call). Returns the lines as `{ level, text }`.
 */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
