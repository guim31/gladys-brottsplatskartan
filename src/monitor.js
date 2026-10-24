// -----------------------------------------------------------------------------
// The monitor: reads the new police events of Sweden every `refresh_interval`
// minutes, keeps the last days of them, sorts them into the followed zones,
// publishes the states of the devices, fires the scene trigger and serves the
// widget and the actions.
//
// Zones: `radius`, the events within the radius of the centre (the coordinates
// of the configuration, or the first located house of Gladys), and `area`, the
// events of the chosen county or of the named places. An event the police
// locates only by its county has no meaningful position: it can be in the area
// zone, never in the radius zone. The distance is measured to the position
// Brottsplatskartan gives, often the centre of a town or a district.
//
// Trigger: "new event" when an event never read before falls in a zone, once
// per zone. The events already listed at the very first start fire nothing,
// nor do events published long ago and listed late. Ids only grow: a change of
// configuration brings no false news. What was read is kept under /data.
//
// States: `publishChangedStates` sends only what changed, plus a heartbeat every
// 12 hours. The coordinates of the centre are never logged.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { fold, zonesOf } from './config.js';
import { MAX_DISTANCE_KM, buildDevice, deviceIds } from './device.js';
import { fetchNewEvents } from './bpk.js';
import { distanceKm } from './geo.js';
import { CATEGORY_NAMES, PHRASES, STATUS, ZONE_NAMES, describe, join, render } from './messages.js';
import { CATEGORIES, typeLabel } from './types.js';

const logger = createLogger({ name: 'brottsplatskartan' });

export const WIDGET_KEY = 'events';
export const TRIGGER = 'new_event';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const DEFAULT_TIMINGS = {
  heartbeatMs: 12 * HOUR,
  // Events kept in memory and under /data: the "latest event" of a quiet zone.
  historyMs: 3 * DAY,
  // The window of the counters.
  windowMs: DAY,
  // An event published longer ago than this, read for the first time, is not news.
  freshMs: 2 * HOUR,
  // requestWidgetRefresh is rate-limited to one call every 10 s by the core.
  widgetRefreshMs: 10000,
  // The houses of Gladys are read again this often (no update event).
  housesMaxAgeMs: HOUR,
};

// Scene events fired by one cycle at most: the core takes 300 a minute.
export const MAX_EVENTS_PER_CYCLE = 20;

const newestFirst = (a, b) => b.time - a.time || b.id - a.id;

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK fake)
   * @param {object} options.store see src/store.js
   * @param {Function} [options.fetch] fetch
   * @param {boolean} [options.timers] false: no background timer (tests drive the cycles)
   * @param {Function} [options.now] clock in ms
   * @param {object} [options.timings] overrides of DEFAULT_TIMINGS
   */
  constructor({ gladys, store, fetch: fetchImpl, timers = true, now, timings }) {
    this.gladys = gladys;
    this.store = store;
    this.fetch = fetchImpl ?? ((...args) => fetch(...args));
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = null;
    this.data = emptyData();
    // Per zone, the events of the history in that zone, newest first.
    this.zoneEvents = {};
    // The events of every zone of the last 24 hours, newest first (widget, actions).
    this.events = [];
    this.lastSuccessAt = null;
    this.lastCycleAt = -Infinity;
    this.house = undefined;
    this.houseReadAt = -Infinity;
    this.statusMessage = undefined;
    this.cycleTimer = null;
    this.running = null;
    this.lastRefreshAt = -Infinity;
    this.refreshTimer = null;
    // null: the first successful cycle always nudges the widget, even without event.
    this.signature = null;
    this.stopped = false;
    // Keys of the failures already logged, so a repeated one is not logged again.
    this.failing = new Set();
  }

  /** Log a failure once (warn or error), then at debug until `recovered(key)`. */
  failed(key, level, message, err) {
    const details = err ? [message, err] : [message];
    if (this.failing.has(key)) {
      logger.debug(...details);
      return;
    }
    this.failing.add(key);
    logger[level](...details);
  }

  /** One line when a failure logged by `failed(key)` is over. */
  recovered(key, message) {
    if (this.failing.delete(key)) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    if (saved?.version === 1 && Array.isArray(saved.events)) {
      this.data = { ...emptyData(), ...saved };
    }
    await this.publishDiscovered();
    this.warnAboutConfig();
    logger.info(`Started: police events read every ${config.refreshMinutes} min`);
    this.schedule();
    this.runCycle();
  }

  /** Reconnection: Gladys may have restarted, publish everything again. */
  async resync(config) {
    this.config = config;
    this.houseReadAt = -Infinity;
    await this.publishDiscovered();
    this.statusMessage = undefined;
    await this.updateConnectionStatus();
    this.gladys.forgetPublishedStates?.();
    await this.publishStates();
    this.requestRefresh();
  }

  async reconfigure(config) {
    // A cycle already running finishes with the old configuration, whole.
    await this.running;
    this.config = config;
    this.houseReadAt = -Infinity;
    logger.info('Configuration saved');
    this.warnAboutConfig();
    // The zones may have changed, or the language of the names.
    await this.publishDiscovered();
    // The zones are sorted again at once: Brottsplatskartan may not answer.
    this.sortIntoZones(await this.center());
    this.schedule();
    await this.runCycle();
    await this.publishStates();
    this.requestRefresh();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    this.cycleTimer = null;
    await this.running?.catch(() => {});
    await this.store.flush();
  }

  schedule() {
    if (!this.timers || this.stopped) {
      return;
    }
    clearInterval(this.cycleTimer);
    this.cycleTimer = setInterval(() => this.runCycle(), this.config.refreshMinutes * MINUTE);
    this.cycleTimer.unref?.();
  }

  warnAboutConfig() {
    if (this.config.invalidCenter) {
      logger.warn('The coordinates of the configuration are not valid: the house is used');
    }
    if (this.zones().length === 0) {
      logger.warn('No zone configured: nothing is followed');
    }
  }

  zones() {
    return zonesOf(this.config);
  }

  async publishDiscovered() {
    await this.gladys.publishDiscoveredDevices(
      this.zones().map((zone) => buildDevice(this.gladys, zone, this.config.language)),
    );
  }

  isCreated(zone) {
    const id = deviceIds(this.gladys, zone).device;
    return (this.gladys.devices ?? []).some((device) => device.external_id === id);
  }

  /** The zone of a Gladys device of this integration, or null. */
  zoneOf(device) {
    return (
      this.zones().find((zone) => deviceIds(this.gladys, zone).device === device?.external_id) ??
      null
    );
  }

  // --- Centre ------------------------------------------------------------------

  /** The centre of the radius: the configured coordinates, else the first located house. */
  async center() {
    if (this.config.center) {
      return this.config.center;
    }
    if (this.now() - this.houseReadAt >= this.timings.housesMaxAgeMs) {
      try {
        const houses = await this.gladys.getHouses();
        this.house =
          houses.find(
            (house) => Number.isFinite(house.latitude) && Number.isFinite(house.longitude),
          ) ?? null;
        this.houseReadAt = this.now();
        this.recovered('houses', 'The houses of Gladys are readable again');
      } catch (err) {
        this.failed('houses', 'warn', `Cannot read the houses of Gladys: ${err.message}`);
      }
    }
    return this.house ? { latitude: this.house.latitude, longitude: this.house.longitude } : null;
  }

  // --- Cycles ------------------------------------------------------------------

  runCycle() {
    if (this.running || this.stopped) {
      return this.running;
    }
    this.running = this.cycle()
      .catch((err) => this.failed('cycle', 'error', 'Refresh cycle failed', err))
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  async cycle() {
    const now = this.now();
    this.lastCycleAt = now;
    const previousId = this.data.newestId;
    let fetched;
    try {
      fetched = await fetchNewEvents(this.fetch, {
        afterId: previousId,
        since: now - (previousId > 0 ? this.timings.historyMs : this.timings.windowMs),
      });
      this.recovered('api', 'Brottsplatskartan answers again');
    } catch (err) {
      this.failed('api', 'warn', `Brottsplatskartan unreachable: ${err.message}`);
      await this.updateConnectionStatus();
      return;
    }
    if (fetched.truncated) {
      logger.debug('More new events than the page cap: the oldest ones are skipped');
    }
    const known = new Set(this.data.events.map((event) => event.id));
    const added = fetched.events.filter((event) => !known.has(event.id));
    const seed = !this.data.seeded;
    this.data.events = [...added, ...this.data.events]
      .filter((event) => now - event.time <= this.timings.historyMs)
      .sort(newestFirst);
    this.data.newestId = Math.max(previousId, fetched.newestId);
    this.data.seeded = true;
    this.store.save(this.data);

    const center = await this.center();
    this.sortIntoZones(center);
    logger.debug(
      `Refresh cycle: ${added.length} new event(s), ${this.events.length} followed in 24 h`,
    );
    if (seed) {
      logger.debug(`${added.length} event(s) taken as known, no trigger fired`);
    } else {
      await this.fireNew(added);
    }
    this.lastSuccessAt = now;
    this.recovered('cycle', 'Refresh cycles work again');
    await this.publishStates();
    await this.updateConnectionStatus();
    const signature = this.events.map((event) => event.id).join(',');
    if (signature !== this.signature) {
      this.signature = signature;
      this.requestRefresh();
    }
  }

  /** Does an event (with its distance) fall in a zone? */
  inZone(zone, event) {
    if (zone === 'radius') {
      return event.distanceKm !== null && event.distanceKm <= this.config.radiusKm;
    }
    const { county, places } = this.config;
    if (county && event.county === county.key) {
      return true;
    }
    const folded = places.map(fold);
    return event.places.some((place) => folded.includes(fold(place)));
  }

  /** The events of the history, with their distance, sorted into the zones. */
  sortIntoZones(center) {
    const now = this.now();
    const withDistance = this.data.events.map((event) => ({
      ...event,
      distanceKm:
        center && event.precise
          ? distanceKm(center.latitude, center.longitude, event.latitude, event.longitude)
          : null,
    }));
    this.zoneEvents = {};
    const recent = new Map();
    for (const zone of this.zones()) {
      this.zoneEvents[zone] = withDistance.filter((event) => this.inZone(zone, event));
      for (const event of this.zoneEvents[zone]) {
        if (now - event.time <= this.timings.windowMs) {
          recent.set(event.id, event);
        }
      }
    }
    this.events = [...recent.values()].sort(newestFirst);
  }

  /** Fire the scene trigger for the new events of each zone. */
  async fireNew(added) {
    const now = this.now();
    const ids = new Set(added.map((event) => event.id));
    const fired = [];
    for (const zone of this.zones()) {
      for (const event of this.zoneEvents[zone]) {
        if (ids.has(event.id) && now - event.time <= this.timings.freshMs) {
          fired.push({ zone, event });
        }
      }
    }
    fired.sort((a, b) => a.event.time - b.event.time || a.event.id - b.event.id);
    for (const [index, change] of fired.entries()) {
      if (index >= MAX_EVENTS_PER_CYCLE) {
        logger.debug(`${fired.length - index} more event(s) not sent to the scenes`);
        break;
      }
      logger.debug(`New event (${change.zone}): ${change.event.type}, ${change.event.place}`);
      try {
        await this.gladys.publishSceneEvent(TRIGGER, this.eventData(change.zone, change.event));
        this.recovered('scene', 'Scene triggers work again');
      } catch (err) {
        this.failed('scene', 'warn', `Firing the scene trigger failed: ${err.message}`);
      }
    }
  }

  /** The flat data of a scene event (fields, then variables of the manifest). */
  eventData(zone, event) {
    const language = this.config.language;
    return {
      zone,
      category: event.category,
      zone_name: ZONE_NAMES[language][zone],
      category_name: CATEGORY_NAMES[language][event.category],
      type: event.type,
      type_name: typeLabel(event.type, language),
      place: event.place,
      location: event.location,
      distance_km: event.distanceKm === null ? null : Math.round(event.distanceKm * 10) / 10,
      headline: event.headline,
      summary: describe(event, language),
      time: new Date(event.time).toISOString(),
      url: event.url,
    };
  }

  // --- States ------------------------------------------------------------------

  /** The states of the device of a zone, from the last successful cycle. */
  statesOf(zone) {
    const ids = deviceIds(this.gladys, zone);
    const language = this.config.language;
    const now = this.now();
    const events = this.zoneEvents[zone] ?? [];
    const recent = events.filter((event) => now - event.time <= this.timings.windowMs);
    const latest = events[0] ?? null;
    const states = [
      { device_feature_external_id: ids.total, state: recent.length },
      ...CATEGORIES.map((category) => ({
        device_feature_external_id: ids.categories[category],
        state: recent.filter((event) => event.category === category).length,
      })),
      {
        device_feature_external_id: ids.latest,
        text: latest ? describe(latest, language) : PHRASES[language].none,
      },
    ];
    if (zone === 'radius' && latest && latest.distanceKm !== null) {
      states.push({
        device_feature_external_id: ids.distance,
        state: Math.min(MAX_DISTANCE_KM, Math.round(latest.distanceKm * 10) / 10),
      });
    }
    return states;
  }

  async publishStates() {
    if (this.lastSuccessAt === null) {
      return;
    }
    const states = this.zones()
      .filter((zone) => this.isCreated(zone))
      .flatMap((zone) => this.statesOf(zone));
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('publish', 'Publishing the states works again');
    } catch (err) {
      // Sent again at the next cycle (the SDK forgets what Gladys refused).
      this.failed('publish', 'warn', `Publishing the states failed: ${err.message}`);
    }
  }

  async updateConnectionStatus() {
    const parts = [];
    if (this.failing.has('api')) {
      parts.push(render(STATUS, 'apiDown'));
    }
    const zones = this.zones();
    if (zones.length === 0) {
      parts.push(render(STATUS, 'noZone'));
    }
    if (zones.includes('radius') && !this.config.center && !this.house) {
      parts.push(render(STATUS, 'noCenter'));
    } else if (this.config.invalidCenter) {
      parts.push(render(STATUS, 'invalidCenter'));
    }
    const message = parts.length > 0 ? join(...parts) : undefined;
    const connected = !this.failing.has('api') && this.lastSuccessAt !== null;
    const key = JSON.stringify([connected, message]);
    if (key === this.statusMessage) {
      return;
    }
    this.statusMessage = key;
    await this.gladys.setConnectionStatus(connected, message).catch(() => {});
  }

  // --- Gladys events -----------------------------------------------------------

  async onDeviceCreated(device) {
    if (!this.zoneOf(device)) {
      return;
    }
    if (this.lastSuccessAt === null) {
      await this.runCycle();
    }
    // The SDK forgot the states of the device: everything is published again.
    await this.publishStates();
    this.requestRefresh();
  }

  /** onPoll fallback: should_poll is false, but a Gladys polling anyway gets an answer. */
  async poll(device) {
    if (!this.zoneOf(device)) {
      return;
    }
    // Read again only if the last cycle is older than half the interval.
    if (this.now() - this.lastCycleAt >= (this.config.refreshMinutes * MINUTE) / 2) {
      await this.runCycle();
    } else {
      await this.publishStates();
    }
  }

  /** The followed events, read again if the last cycle is older than one interval. */
  async fresh() {
    if (this.now() - this.lastCycleAt >= this.config.refreshMinutes * MINUTE) {
      await this.runCycle();
    } else {
      await this.running;
    }
    return { events: this.events, ok: this.lastSuccessAt !== null };
  }

  // --- Widget -------------------------------------------------------------------

  requestRefresh() {
    if (this.stopped) {
      return;
    }
    const now = this.now();
    const wait = this.lastRefreshAt + this.timings.widgetRefreshMs - now;
    if (wait <= 0) {
      this.lastRefreshAt = now;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } else if (this.timers && !this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.requestRefresh();
      }, wait);
      this.refreshTimer.unref?.();
    }
  }
}

function emptyData() {
  return { version: 1, seeded: false, newestId: 0, events: [] };
}
