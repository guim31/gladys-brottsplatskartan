// -----------------------------------------------------------------------------
// The Gladys devices: one per followed zone (`radius`: around the house or
// coordinates; `area`: a county and/or named places).
//
// Features (couples checked against the Gladys front, see
// test/gladys-rules.test.js):
//   - events_24h          counter-sensor/integer: the events of the last 24 hours;
//   - <category>_24h      counter-sensor/integer, one per category of
//                         src/types.js (burglary, theft, violence, fire,
//                         traffic_accident, other);
//   - latest_event        text/text: the newest event, in words (type, place,
//                         time, distance);
//   - latest_distance     distance-sensor/decimal, km, radius zone only: how
//                         far the newest event is from the centre.
//
// Published with should_poll: false: the refresh runs in the container
// (src/monitor.js). The platform id is the zone key: changing the radius, the
// county or the places keeps the device and its history.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { CATEGORIES } from './types.js';

export const DEVICE_TYPE = 'zone';
export const FEATURE_KEYS = {
  TOTAL: 'events_24h',
  LATEST: 'latest_event',
  DISTANCE: 'latest_distance',
};
export const categoryFeature = (category) => `${category}_24h`;

export const MAX_COUNT = 1000;
// The radius is 50 km at most; an event a little beyond still fits.
export const MAX_DISTANCE_KM = 100;

// Feature names, frozen at creation in Gladys (language of the configuration).
export const NAMES = {
  en: {
    radius: 'Police events near home',
    area: 'Police events in my area',
    events_24h: 'Events (24 h)',
    burglary_24h: 'Burglaries (24 h)',
    theft_24h: 'Thefts (24 h)',
    violence_24h: 'Violence (24 h)',
    fire_24h: 'Fires (24 h)',
    traffic_accident_24h: 'Road accidents (24 h)',
    other_24h: 'Other events (24 h)',
    latest_event: 'Latest event',
    latest_distance: 'Latest event distance',
  },
  fr: {
    radius: 'Interventions de police près de chez moi',
    area: 'Interventions de police dans ma zone',
    events_24h: 'Événements (24 h)',
    burglary_24h: 'Cambriolages (24 h)',
    theft_24h: 'Vols (24 h)',
    violence_24h: 'Violences (24 h)',
    fire_24h: 'Incendies (24 h)',
    traffic_accident_24h: 'Accidents de la route (24 h)',
    other_24h: 'Autres événements (24 h)',
    latest_event: 'Dernier événement',
    latest_distance: 'Distance du dernier événement',
  },
  de: {
    radius: 'Polizeimeldungen in der Nähe',
    area: 'Polizeimeldungen in meinem Gebiet',
    events_24h: 'Ereignisse (24 h)',
    burglary_24h: 'Einbrüche (24 h)',
    theft_24h: 'Diebstähle (24 h)',
    violence_24h: 'Gewalt (24 h)',
    fire_24h: 'Brände (24 h)',
    traffic_accident_24h: 'Verkehrsunfälle (24 h)',
    other_24h: 'Sonstige Ereignisse (24 h)',
    latest_event: 'Neuestes Ereignis',
    latest_distance: 'Entfernung des neuesten Ereignisses',
  },
  es: {
    radius: 'Sucesos policiales cerca de casa',
    area: 'Sucesos policiales en mi zona',
    events_24h: 'Sucesos (24 h)',
    burglary_24h: 'Robos en viviendas (24 h)',
    theft_24h: 'Hurtos (24 h)',
    violence_24h: 'Violencia (24 h)',
    fire_24h: 'Incendios (24 h)',
    traffic_accident_24h: 'Accidentes de tráfico (24 h)',
    other_24h: 'Otros sucesos (24 h)',
    latest_event: 'Último suceso',
    latest_distance: 'Distancia del último suceso',
  },
};

/** External ids of the device of a zone and of its features. */
export function deviceIds(gladys, zone) {
  const ids = gladys.externalIds(DEVICE_TYPE, zone);
  return {
    device: ids.device,
    total: ids.feature(FEATURE_KEYS.TOTAL),
    categories: Object.fromEntries(
      CATEGORIES.map((category) => [category, ids.feature(categoryFeature(category))]),
    ),
    latest: ids.feature(FEATURE_KEYS.LATEST),
    distance: ids.feature(FEATURE_KEYS.DISTANCE),
  };
}

const sensor = (name, externalId, category, type, extra) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  ...extra,
});

const counter = (name, externalId) =>
  sensor(name, externalId, DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR, TYPES.SENSOR.INTEGER, {
    keep_history: true,
    min: 0,
    max: MAX_COUNT,
  });

/** The discovery payload of the device of a zone. */
export function buildDevice(gladys, zone, language = 'fr') {
  const ids = deviceIds(gladys, zone);
  const names = NAMES[language] ?? NAMES.fr;
  const features = [
    counter(names.events_24h, ids.total),
    ...CATEGORIES.map((category) =>
      counter(names[categoryFeature(category)], ids.categories[category]),
    ),
    sensor(names.latest_event, ids.latest, DEVICE_FEATURE_CATEGORIES.TEXT, TYPES.TEXT.TEXT, {
      keep_history: false,
      min: 0,
      max: 0,
    }),
  ];
  if (zone === 'radius') {
    features.push(
      sensor(
        names.latest_distance,
        ids.distance,
        DEVICE_FEATURE_CATEGORIES.DISTANCE_SENSOR,
        TYPES.SENSOR.DECIMAL,
        { unit: DEVICE_FEATURE_UNITS.KM, keep_history: true, min: 0, max: MAX_DISTANCE_KM },
      ),
    );
  }
  return {
    name: names[zone],
    external_id: ids.device,
    model: 'Brottsplatskartan',
    should_poll: false,
    params: [],
    features,
  };
}
