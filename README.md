# Brottsplatskartan for Gladys Assistant

The events of the Swedish police in [Gladys Assistant](https://gladysassistant.com): burglaries,
thefts, violence, fires, road accidents and the rest, around your home, in a county (län) or in the
places you name, as published on [polisen.se](https://polisen.se/aktuellt/handelser/) and geocoded
by [Brottsplatskartan](https://brottsplatskartan.se). No account, no API key.

Not an alarm: the police publishes its events minutes to hours after the facts. Not affiliated
with Brottsplatskartan nor with the Swedish police.

## Features

- **One device per zone**: "near home" (a radius of 2 to 50 km around your house or coordinates)
  and "my area" (a county and/or named municipalities, towns or districts). Each one counts the
  events of the last 24 hours by category (burglary, theft, violence, fire, road accident, other)
  and gives the latest event in words; the radius device also gives its distance. With history.
- **Scene trigger**: a new police event in a zone, filtered by zone and category, with the event
  details as scene variables (type translated and in Swedish, place, distance, link).
- **Scene action**: the events of the last 24 hours as one sentence, to send by message or have
  read aloud, with their number.
- **Dashboard widget**: the events of your zones, newest first, with a category badge and a link
  to each event on Brottsplatskartan.
- Police event types translated into English, French, German and Spanish, the Swedish label kept;
  every text of the integration in these four languages.

## Requirements

- Gladys Assistant 5.1 or later.
- Internet access from the Gladys host (`brottsplatskartan.se`).
- For the radius zone: a location for your house in Gladys, or coordinates in the configuration.

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-brottsplatskartan` (or install it from the catalog once it is
   listed). The install screen shows the **location** access it asks for (the centre of the
   radius).
2. In **Configuration**, choose the radius, and optionally a county and places, then save.
   **Show the latest events** lists what your settings catch.
3. Open the **Discover** tab and add the devices.

The user guide is in [`docs/en.md`](docs/en.md) ([français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md)); Gladys links it from the Configuration screen.

## How it works

```
Integration container ──HTTPS──▶ brottsplatskartan.se   /api/events?app=gladys-assistant
      │ SDK (WebSocket + host API)
      ▼
Gladys core ── devices, states, scene events, scene action, widget
```

- Every 10, 15 or 30 minutes the container reads the newest police events of all of Sweden, page
  after page until an event it already knows (one page of 30 in practice; 100 at the very first
  start, back to 24 hours). The ids only grow, so a change of settings or a restart brings no false
  news. The devices are published with `should_poll: false`: the core does not poll external
  devices reliably (GladysAssistant/Gladys#3198).
- Three days of events are kept under `/data`. Each zone is computed in the container: the
  great-circle distance to the position Brottsplatskartan gives (often the centre of a town or a
  district), or the county and the places of the event. An event located by its county only never
  counts in the radius zone. The police summaries of a night ("Sammanfattning natt") are left out.

## Limitations

- Positions are approximate: the police names a town, a district or a street.
- Headlines and summaries stay in Swedish; event types are translated from a list of the police
  types.
- Developed and tested against the real Brottsplatskartan service and the SDK's fake Gladys; not
  yet on a real Gladys instance: feedback welcome.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and a fake Brottsplatskartan serving 240 real events
recorded on 24/10/2026 (`test/fixtures/brottsplatskartan/`): never the network.

## Credits

- Data: the Swedish police ([polisen.se](https://polisen.se)), through
  [Brottsplatskartan](https://brottsplatskartan.se) and its open API
  ([terms](https://brottsplatskartan.se/sida/api): free for non-commercial use, an `app`
  parameter on every call).
- The Home Assistant [Brottsplatskartan integration](https://www.home-assistant.io/integrations/brottsplatskartan/)
  showed what users expect from such an integration; no code is copied from it.
- Cover: the Brottsplatskartan mark and colour, from [brottsplatskartan.se](https://brottsplatskartan.se)
  (its site icon).
- Built on the [Gladys integration SDK](https://github.com/GladysAssistant/integration-sdk-js) and
  the official JavaScript template.

## License

[Apache 2.0](LICENSE).
