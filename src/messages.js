// -----------------------------------------------------------------------------
// Texts sent from the container (feature values, connection status, action and
// scene messages, scene variables), in the four languages of the Gladys
// interface. Entries are strings or functions of one parameter object. German
// says "du", Spanish "usted". Places, headlines and descriptions come from the
// police, in Swedish: they are not translated; event types are (src/types.js).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';
import { typeLabel } from './types.js';

export const CATEGORY_NAMES = {
  en: {
    burglary: 'Burglary',
    theft: 'Theft',
    violence: 'Violence',
    fire: 'Fire',
    traffic_accident: 'Road accident',
    other: 'Other',
  },
  fr: {
    burglary: 'Cambriolage',
    theft: 'Vol',
    violence: 'Violence',
    fire: 'Incendie',
    traffic_accident: 'Accident de la route',
    other: 'Autre',
  },
  de: {
    burglary: 'Einbruch',
    theft: 'Diebstahl',
    violence: 'Gewalt',
    fire: 'Brand',
    traffic_accident: 'Verkehrsunfall',
    other: 'Sonstiges',
  },
  es: {
    burglary: 'Robo en vivienda',
    theft: 'Hurto',
    violence: 'Violencia',
    fire: 'Incendio',
    traffic_accident: 'Accidente de tráfico',
    other: 'Otros',
  },
};

// The same, short enough for a widget badge (16 characters).
export const CATEGORY_BADGES = {
  en: { ...CATEGORY_NAMES.en, traffic_accident: 'Accident' },
  fr: { ...CATEGORY_NAMES.fr, traffic_accident: 'Accident' },
  de: { ...CATEGORY_NAMES.de, traffic_accident: 'Unfall' },
  es: { ...CATEGORY_NAMES.es, traffic_accident: 'Accidente' },
};

/** Colour of a category in the closed widget palette. */
export const CATEGORY_COLORS = {
  burglary: WIDGET_COLORS.WARNING,
  theft: WIDGET_COLORS.WARNING,
  violence: WIDGET_COLORS.DANGER,
  fire: WIDGET_COLORS.DANGER,
  traffic_accident: WIDGET_COLORS.INFO,
  other: WIDGET_COLORS.NEUTRAL,
};

export const ZONE_NAMES = {
  en: { radius: 'Near home', area: 'My area' },
  fr: { radius: 'Près de chez moi', area: 'Ma zone' },
  de: { radius: 'In der Nähe', area: 'Mein Gebiet' },
  es: { radius: 'Cerca de casa', area: 'Mi zona' },
};

// Values of the "Latest event" feature, and pieces of sentences.
export const PHRASES = {
  en: {
    none: 'No recent event',
    item: ({ what, place, time, km }) =>
      `${what}${place ? ` in ${place}` : ''}, ${time}${km === null ? '' : `, ${km} km away`}`,
    list: ({ head, items }) => `${head}: ${items.join('; ')}.`,
    more: ({ count }) => `and ${count} more`,
    events: ({ count }) =>
      count === 1 ? '1 police event in 24 hours' : `${count} police events in 24 hours`,
    noEvent: 'No police event in your area in the last 24 hours.',
  },
  fr: {
    none: 'Aucun événement récent',
    item: ({ what, place, time, km }) =>
      `${what}${place ? ` à ${place}` : ''}, ${time}${km === null ? '' : `, à ${km} km`}`,
    list: ({ head, items }) => `${head} : ${items.join(' ; ')}.`,
    more: ({ count }) => `et ${count} de plus`,
    events: ({ count }) =>
      count === 1
        ? '1 événement de police en 24 heures'
        : `${count} événements de police en 24 heures`,
    noEvent: 'Aucun événement de police dans votre zone ces dernières 24 heures.',
  },
  de: {
    none: 'Kein aktuelles Ereignis',
    item: ({ what, place, time, km }) =>
      `${what}${place ? ` in ${place}` : ''}, ${time}${km === null ? '' : `, ${km} km entfernt`}`,
    list: ({ head, items }) => `${head}: ${items.join('; ')}.`,
    more: ({ count }) => `und ${count} weitere`,
    events: ({ count }) =>
      count === 1 ? '1 Polizeimeldung in 24 Stunden' : `${count} Polizeimeldungen in 24 Stunden`,
    noEvent: 'Keine Polizeimeldung in deinem Gebiet in den letzten 24 Stunden.',
  },
  es: {
    none: 'Ningún suceso reciente',
    item: ({ what, place, time, km }) =>
      `${what}${place ? ` en ${place}` : ''}, ${time}${km === null ? '' : `, a ${km} km`}`,
    list: ({ head, items }) => `${head}: ${items.join('; ')}.`,
    more: ({ count }) => `y ${count} más`,
    events: ({ count }) =>
      count === 1 ? '1 suceso policial en 24 horas' : `${count} sucesos policiales en 24 horas`,
    noEvent: 'Ningún suceso policial en su zona en las últimas 24 horas.',
  },
};

// Connection status of the Configuration screen, and messages of the actions.
export const STATUS = {
  en: {
    initFailed: 'Initialization failed, check the integration logs.',
    apiDown: 'Brottsplatskartan does not answer: the events are not updated.',
    noCenter:
      'No centre for the radius: give your house a location in Gladys (Settings, Houses) or type coordinates.',
    invalidCenter: 'The coordinates are not valid: the location of your house is used.',
    noZone: 'No zone: choose a radius, a county or places.',
    summary: ({ text, time }) => `${text} Checked at ${time}.`,
  },
  fr: {
    initFailed: "L'initialisation a échoué, consultez les logs de l'intégration.",
    apiDown: 'Brottsplatskartan ne répond pas : les événements ne sont pas mis à jour.',
    noCenter:
      'Aucun centre pour le rayon : indiquez la position de votre maison dans Gladys (Paramètres, Maisons) ou saisissez des coordonnées.',
    invalidCenter:
      'Les coordonnées ne sont pas valides : la position de votre maison est utilisée.',
    noZone: 'Aucune zone : choisissez un rayon, un comté ou des lieux.',
    summary: ({ text, time }) => `${text} Vérifié à ${time}.`,
  },
  de: {
    initFailed: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    apiDown: 'Brottsplatskartan antwortet nicht: Die Ereignisse werden nicht aktualisiert.',
    noCenter:
      'Kein Mittelpunkt für den Radius: Gib deinem Haus in Gladys einen Standort (Einstellungen, Häuser) oder trage Koordinaten ein.',
    invalidCenter: 'Die Koordinaten sind ungültig: Der Standort deines Hauses wird verwendet.',
    noZone: 'Keine Zone: Wähle einen Radius, eine Provinz oder Orte.',
    summary: ({ text, time }) => `${text} Geprüft um ${time}.`,
  },
  es: {
    initFailed: 'La inicialización ha fallado, consulte los registros de la integración.',
    apiDown: 'Brottsplatskartan no responde: los sucesos no se actualizan.',
    noCenter:
      'Sin centro para el radio: indique la ubicación de su casa en Gladys (Ajustes, Casas) o introduzca coordenadas.',
    invalidCenter: 'Las coordenadas no son válidas: se usa la ubicación de su casa.',
    noZone: 'Ninguna zona: elija un radio, una provincia o lugares.',
    summary: ({ text, time }) => `${text} Comprobado a las ${time}.`,
  },
};

/** One entry of a message table, in every language: `{ en, fr, de, es }`. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const entry = table[language][key];
      return [language, typeof entry === 'function' ? entry(params) : entry];
    }),
  );
}

/** Several multi-language texts joined, language by language. */
export function join(...messages) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      messages
        .filter(Boolean)
        .map((message) => message[language])
        .join(' '),
    ]),
  );
}

const locale = (language) => (language === 'en' ? 'en-GB' : language);

/** A date in the user's time zone (TZ, set by the Gladys supervisor), e.g. "24/10 09:38". */
export function formatDate(time, language) {
  return new Intl.DateTimeFormat(locale(language), {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

/** A time of day, e.g. "09:38". */
export function formatTime(time, language) {
  return new Intl.DateTimeFormat(locale(language), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

/** A number in the user's language, e.g. "2,3" in French. */
export function formatNumber(value, language, digits = 0) {
  return new Intl.NumberFormat(locale(language), {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

/** A distance: one decimal under 10 km, e.g. "2,3 km", "14 km". */
export function formatKm(distance, language) {
  return distance < 10
    ? formatNumber(Math.round(distance * 10) / 10, language, 1)
    : formatNumber(Math.round(distance), language);
}

/**
 * The value of the "Latest event" feature, e.g.
 * "Cambriolage (Inbrott) · Solna · 24/10 09:38 · 2,3 km".
 */
export function describe(event, language) {
  return [
    typeLabel(event.type, language),
    event.place,
    formatDate(event.time, language),
    event.distanceKm === null || event.distanceKm === undefined
      ? ''
      : `${formatKm(event.distanceKm, language)} km`,
  ]
    .filter(Boolean)
    .join(' · ');
}

// Events named in one sentence: a scene that reads it aloud stays short.
export const SENTENCE_EVENTS = 5;

/**
 * The events as one sentence, newest first, e.g. "2 police events in 24
 * hours: Fire (Brand) in Malmö, 09:00, 3.7 km away; Drink or drug driving
 * (Rattfylleri) in Malmö, 06:51, 0.5 km away."
 */
export function sentence(events, language, max = SENTENCE_EVENTS) {
  const p = PHRASES[language];
  if (events.length === 0) {
    return p.noEvent;
  }
  const parts = events.slice(0, max).map((event) =>
    p.item({
      what: typeLabel(event.type, language),
      place: event.place,
      time: formatTime(event.time, language),
      km:
        event.distanceKm === null || event.distanceKm === undefined
          ? null
          : formatKm(event.distanceKm, language),
    }),
  );
  const rest = events.length - max;
  if (rest > 0) {
    parts.push(p.more({ count: rest }));
  }
  return p.list({ head: p.events({ count: events.length }), items: parts });
}
