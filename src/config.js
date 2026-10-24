// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// Two zones can be followed, each one a Gladys device:
//   - `radius`: the events within a radius of the house (or of coordinates);
//   - `area`:   the events of a county (län) and/or of named places
//               (municipalities, towns, districts), as the police names them.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const ZONES = ['radius', 'area'];

// Kilometres around the centre; 0 turns the radius zone off. The police often
// locates an event at the centre of a town or a district only: no radius under
// 2 km, and 10 km by default.
export const RADII = ['0', '2', '5', '10', '20', '50'];

// Minutes between two readings. Brottsplatskartan caches its answers for 2 to
// 5 minutes and the police publishes a few events an hour for all of Sweden.
export const REFRESH_INTERVALS = ['10', '15', '30'];

// The 21 Swedish counties. `key` is the stable value of the manifest, `name`
// the exact name Brottsplatskartan uses (`administrative_area_level_1`), and
// `aliases` the other spellings seen in its data (/api/areas, 24/10/2026).
export const COUNTIES = [
  { key: 'blekinge', name: 'Blekinge län' },
  { key: 'dalarna', name: 'Dalarnas län' },
  { key: 'gavleborg', name: 'Gävleborgs län' },
  { key: 'gotland', name: 'Gotlands län' },
  { key: 'halland', name: 'Hallands län' },
  { key: 'jamtland', name: 'Jämtlands län' },
  { key: 'jonkoping', name: 'Jönköpings län' },
  { key: 'kalmar', name: 'Kalmar län' },
  { key: 'kronoberg', name: 'Kronobergs län' },
  { key: 'norrbotten', name: 'Norrbottens län' },
  { key: 'skane', name: 'Skåne län', aliases: ['Skåne County'] },
  { key: 'stockholm', name: 'Stockholms län' },
  { key: 'sodermanland', name: 'Södermanlands län' },
  { key: 'uppsala', name: 'Uppsala län' },
  { key: 'varmland', name: 'Värmlands län' },
  { key: 'vasterbotten', name: 'Västerbottens län' },
  { key: 'vasternorrland', name: 'Västernorrlands län' },
  { key: 'vastmanland', name: 'Västmanlands län' },
  { key: 'vastra_gotaland', name: 'Västra Götalands län', aliases: ['Västra Götaland'] },
  { key: 'orebro', name: 'Örebro län' },
  { key: 'ostergotland', name: 'Östergötlands län' },
];
export const COUNTY_KEYS = ['none', ...COUNTIES.map((county) => county.key)];

export const DEFAULT_CONFIG = {
  latitude: '',
  longitude: '',
  radius: '10',
  county: 'none',
  places: '',
  refresh_interval: '15',
  language: 'fr',
};

/** Lower case, without diacritics: "Malmö" and "malmo" are the same place. */
export const fold = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** A coordinate typed by the user (decimal comma accepted), null if blank or invalid. */
export function parseCoordinate(value, limit) {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) {
    return null;
  }
  const number = Number(text);
  return Math.abs(number) <= limit ? number : null;
}

/** Place names of a free text, separated by commas or semicolons, deduplicated. */
export function parsePlaces(text) {
  const places = [];
  for (const token of String(text ?? '').split(/[,;\n]+/)) {
    const name = token.replace(/\s+/g, ' ').trim();
    if (name && !places.some((place) => fold(place) === fold(name))) {
      places.push(name);
    }
  }
  return places;
}

const pick = (value, allowed, fallback) =>
  allowed.includes(String(value)) ? Number(value) : Number(fallback);

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const latitude = parseCoordinate(source.latitude, 90);
  const longitude = parseCoordinate(source.longitude, 180);
  // Both or none: half a centre falls back on the house.
  const center = latitude !== null && longitude !== null ? { latitude, longitude } : null;
  const typed = String(source.latitude ?? '').trim() + String(source.longitude ?? '').trim();
  const county = COUNTIES.find((entry) => entry.key === source.county) ?? null;
  const places = parsePlaces(source.places);
  return {
    center,
    // Something was typed but is not a pair of coordinates: said once in the logs.
    invalidCenter: center === null && typed !== '',
    radiusKm: pick(source.radius, RADII, DEFAULT_CONFIG.radius),
    county,
    places,
    refreshMinutes: pick(
      source.refresh_interval,
      REFRESH_INTERVALS,
      DEFAULT_CONFIG.refresh_interval,
    ),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}

/** The zones a configuration follows, in the order of ZONES. */
export function zonesOf(config) {
  const zones = [];
  if (config.radiusKm > 0) {
    zones.push('radius');
  }
  if (config.county || config.places.length > 0) {
    zones.push('area');
  }
  return zones;
}
