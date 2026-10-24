// -----------------------------------------------------------------------------
// The police event types: every recorded type falls in the expected category,
// the translations exist in the four languages, and the Swedish label is kept.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, TYPE_ROWS, categoryOf, translateType, typeLabel } from '../src/types.js';
import { fixture } from './helpers/world.js';

const recorded = fixture('brottsplatskartan/events-2026-10-24.json').data;

test('the categories of the police types', () => {
  const expected = {
    Inbrott: 'burglary',
    'Inbrott, försök': 'burglary',
    'Stöld/inbrott': 'burglary',
    Stöld: 'theft',
    'Motorfordon, stöld': 'theft',
    'Stöld, försök': 'theft',
    Rån: 'violence',
    'Rån väpnat': 'violence',
    Misshandel: 'violence',
    'Misshandel,  grov': 'violence',
    'Mord/dråp, försök': 'violence',
    Skottlossning: 'violence',
    Våldtäkt: 'violence',
    'Olaga hot': 'violence',
    Brand: 'fire',
    Mordbrand: 'fire',
    'Brand automatlarm': 'fire',
    Trafikolycka: 'traffic_accident',
    'Trafikolycka,  vilt': 'traffic_accident',
    Rattfylleri: 'other',
    Trafikbrott: 'other',
    Bedrägeri: 'other',
    Övrigt: 'other',
    'Något helt nytt': 'other',
    'Sammanfattning natt': null,
    'Sammanfattning kväll och natt': null,
  };
  for (const [type, category] of Object.entries(expected)) {
    assert.equal(categoryOf(type), category, type);
  }
});

test('every category is met in three recorded days', () => {
  const seen = new Set(recorded.map((event) => categoryOf(event.title_type)));
  for (const category of CATEGORIES) {
    assert.ok(seen.has(category), category);
  }
});

test('every recorded type is translated', () => {
  const missing = [
    ...new Set(
      recorded
        .map((event) => event.title_type)
        .filter((type) => categoryOf(type) !== null && translateType(type, 'en') === null),
    ),
  ];
  assert.deepEqual(missing, []);
});

test('the table has the five languages, without empty text, and no Swedish label twice', () => {
  const seen = new Set();
  for (const row of TYPE_ROWS) {
    assert.equal(row.length, 5, row[0]);
    for (const text of row) {
      assert.ok(typeof text === 'string' && text.trim() !== '' && text.length <= 50, row[0]);
    }
    assert.ok(!seen.has(row[0]), `${row[0]} twice`);
    seen.add(row[0]);
  }
});

test('labels keep the Swedish type next to the translation', () => {
  assert.equal(typeLabel('Inbrott', 'fr'), 'Cambriolage (Inbrott)');
  assert.equal(
    typeLabel('Trafikolycka,  personskada', 'de'),
    'Verkehrsunfall mit Verletzten (Trafikolycka, personskada)',
  );
  assert.equal(typeLabel('Brand', 'de'), 'Brand');
  assert.equal(typeLabel('Något helt nytt', 'es'), 'Något helt nytt');
});
