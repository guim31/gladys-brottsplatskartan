// -----------------------------------------------------------------------------
// Normalization of the configuration: what a user can type or leave empty.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fold, normalizeConfig, parseCoordinate, parsePlaces, zonesOf } from '../src/config.js';

test('the defaults: house, 10 km, no county, 15 min, French', () => {
  assert.deepEqual(normalizeConfig(), {
    center: null,
    invalidCenter: false,
    radiusKm: 10,
    county: null,
    places: [],
    refreshMinutes: 15,
    language: 'fr',
  });
  assert.deepEqual(zonesOf(normalizeConfig()), ['radius']);
});

test('coordinates: decimal point or comma, bounded; both or none', () => {
  assert.equal(parseCoordinate('59,3293', 90), 59.3293);
  assert.equal(parseCoordinate(' -1.5 ', 180), -1.5);
  assert.equal(parseCoordinate('91', 90), null);
  assert.equal(parseCoordinate('N59', 90), null);
  assert.deepEqual(normalizeConfig({ latitude: '57,7', longitude: '11,97' }).center, {
    latitude: 57.7,
    longitude: 11.97,
  });
  const half = normalizeConfig({ latitude: '57.7', longitude: '' });
  assert.equal(half.center, null);
  assert.equal(half.invalidCenter, true);
});

test('places: commas or semicolons, spaces cleaned, deduplicated without accents', () => {
  assert.deepEqual(parsePlaces(' Solna,  Sundbyberg ; malmo, Malmö,, '), [
    'Solna',
    'Sundbyberg',
    'malmo',
  ]);
  assert.equal(fold('  Västra   Götalands LÄN '), 'vastra gotalands lan');
});

test('zones: radius when above 0, area with a county or places', () => {
  assert.deepEqual(zonesOf(normalizeConfig({ radius: '0' })), []);
  assert.deepEqual(zonesOf(normalizeConfig({ county: 'skane' })), ['radius', 'area']);
  assert.deepEqual(zonesOf(normalizeConfig({ radius: '0', places: 'Lund' })), ['area']);
  assert.equal(normalizeConfig({ county: 'skane' }).county.name, 'Skåne län');
});

test('unknown select values fall back on the defaults', () => {
  const config = normalizeConfig({
    radius: '7',
    refresh_interval: '1',
    county: 'oslo',
    language: 'sv',
  });
  assert.equal(config.radiusKm, 10);
  assert.equal(config.refreshMinutes, 15);
  assert.equal(config.county, null);
  assert.equal(config.language, 'fr');
});
