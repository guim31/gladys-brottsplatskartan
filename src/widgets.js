// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `events`.
//
// A heading with the number of events of the last 24 hours in the followed
// zones, then the events as a `card-list` (8 rows at most, the core's cap),
// newest first: the type (translated, with the Swedish label) as title, the
// place, the time and the distance as subtitle, the category as a coloured
// badge. Tapping a row opens the core's detail panel: the police headline and
// summary, in Swedish as published, and a link to the event on
// Brottsplatskartan (the site asks for it). The footer gives the source and the
// time of the last reading, and a link to brottsplatskartan.se.
// Budget: 2 texts, 1 card-list, 1 button.
// -----------------------------------------------------------------------------

import { SITE_URL } from './bpk.js';
import {
  CATEGORY_BADGES,
  CATEGORY_COLORS,
  CATEGORY_NAMES,
  formatDate,
  formatKm,
} from './messages.js';
import { WIDGET_KEY } from './monitor.js';
import { typeLabel } from './types.js';

export const MAX_ITEMS = 8;
export const TTL_SECONDS = 300;

export const TEXT = {
  waiting: {
    en: 'Waiting for the police events…',
    fr: 'En attente des événements…',
    de: 'Warte auf Polizeimeldungen…',
    es: 'Esperando los sucesos…',
  },
  none: {
    en: 'No event in 24 hours',
    fr: 'Aucun événement en 24 h',
    de: 'Kein Ereignis in 24 h',
    es: 'Ningún suceso en 24 h',
  },
  one: {
    en: '1 event in 24 hours',
    fr: '1 événement en 24 h',
    de: '1 Ereignis in 24 h',
    es: '1 suceso en 24 h',
  },
  many: {
    en: ' events in 24 hours',
    fr: ' événements en 24 h',
    de: ' Ereignisse in 24 h',
    es: ' sucesos en 24 h',
  },
  shown: { en: ' shown', fr: ' affichés', de: ' angezeigt', es: ' mostrados' },
  source: {
    en: 'Source: Brottsplatskartan',
    fr: 'Source : Brottsplatskartan',
    de: 'Quelle: Brottsplatskartan',
    es: 'Fuente: Brottsplatskartan',
  },
  open: {
    en: 'Brottsplatskartan',
    fr: 'Brottsplatskartan',
    de: 'Brottsplatskartan',
    es: 'Brottsplatskartan',
  },
};

const t = (text, language) => text[language] ?? text.en;
const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

function heading(events, language) {
  if (events.length === 0) {
    return t(TEXT.none, language);
  }
  if (events.length === 1) {
    return t(TEXT.one, language);
  }
  const shown = events.length > MAX_ITEMS ? ` (${MAX_ITEMS}${t(TEXT.shown, language)})` : '';
  return `${events.length}${t(TEXT.many, language)}${shown}`;
}

/** One row of the list, and its detail panel. */
export function itemOf(event, language) {
  const distance =
    event.distanceKm === null || event.distanceKm === undefined
      ? null
      : `${formatKm(event.distanceKm, language)} km`;
  return {
    title: clip(typeLabel(event.type, language), 60),
    subtitle: clip(
      [event.place, formatDate(event.time, language), distance].filter(Boolean).join(' · '),
      60,
    ),
    badge: {
      text: CATEGORY_BADGES[language][event.category],
      color: CATEGORY_COLORS[event.category],
    },
    // The police writes in Swedish: shown as published.
    description: clip([event.headline, event.description].filter(Boolean).join('\n'), 500),
    links: [{ url: event.url, label: 'Brottsplatskartan' }],
  };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, { language = 'en' } = {}) {
      const lang = CATEGORY_NAMES[language] ? language : 'en';
      const updated = monitor.lastSuccessAt;
      const source = t(TEXT.source, lang);
      const components = [
        {
          type: 'text',
          variant: 'heading',
          text: updated === null ? t(TEXT.waiting, lang) : heading(monitor.events, lang),
        },
      ];
      if (monitor.events.length > 0) {
        components.push({
          type: 'card-list',
          display: 'list',
          items: monitor.events.slice(0, MAX_ITEMS).map((event) => itemOf(event, lang)),
        });
      }
      components.push(
        {
          type: 'text',
          variant: 'caption',
          text: updated === null ? source : `${source} · ${formatDate(updated, lang)}`,
        },
        {
          type: 'button',
          label: t(TEXT.open, lang),
          icon: 'external-link',
          link: { url: SITE_URL },
        },
      );
      return { ttl_seconds: TTL_SECONDS, components };
    },
  },
};
