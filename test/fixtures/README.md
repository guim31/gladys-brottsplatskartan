# Test fixtures

- `gladys-feature-table.json`: the category/type couples, units and poll frequencies the Gladys
  core knows, extracted from its code (see `test/gladys-rules.test.js`).
- `brottsplatskartan/events-2026-10-24.json`: the 240 newest events of
  `https://brottsplatskartan.se/api/events?limit=500&app=gladys-assistant`, read on 24/10/2026 at
  09:23 UTC (20/10 20:06 to 24/10 09:48, Swedish time), with the fields the integration reads; the
  long texts (`content`), the map images and the polisen.se links are left out. Public data of the
  Swedish police, as Brottsplatskartan publishes it; no personal data beyond what the police
  publishes.
- `brottsplatskartan/event-full.json`: one event of
  `/api/events?area=stockholms län&limit=5`, the same day, with every field of the API.
