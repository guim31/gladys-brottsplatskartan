// -----------------------------------------------------------------------------
// The scene action `read_events` and the configuration action `check_now`.
// Both read Brottsplatskartan again when the last cycle is older than one
// interval, and answer with the events of the followed zones of the last 24
// hours as one sentence, newest first: something a scene can send by message
// or read aloud.
//
// The configuration action answers in a toast, cut by the core at 200
// characters: it names the two newest events at most, fewer when their types
// are long.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';
import { PHRASES, STATUS, formatTime, render, sentence } from './messages.js';

const logger = createLogger({ name: 'brottsplatskartan-actions' });

export const SCENE_ACTION = 'read_events';
export const CONFIG_ACTION = 'check_now';
export const TOAST_EVENTS = 2;

const TOAST_MAX = 200;

/** Scene action: outputs `text` and `count`; throws if Brottsplatskartan never answered. */
export async function readEvents(monitor) {
  const { events, ok, stale } = await monitor.fresh();
  const language = monitor.config.language;
  if (!ok) {
    throw new Error(render(STATUS, 'apiDown')[language]);
  }
  const text = sentence(events, language);
  return {
    text: stale ? `${text} ${render(STATUS, 'apiDown')[language]}` : text,
    count: events.length,
  };
}

/** The toast of one language: as many events as fit in TOAST_MAX characters. */
function toast(events, language, time, stale) {
  const prefix = stale ? `${render(STATUS, 'apiDown')[language]} ` : '';
  let text = '';
  for (let max = TOAST_EVENTS; max >= 0; max -= 1) {
    const listed =
      max === 0
        ? PHRASES[language].events({ count: events.length }) + '.'
        : sentence(events, language, max);
    text = prefix + render(STATUS, 'summary', { text: listed, time })[language];
    if (text.length <= TOAST_MAX || events.length === 0) {
      break;
    }
  }
  return text.length <= TOAST_MAX ? text : `${text.slice(0, TOAST_MAX - 1)}…`;
}

/** Configuration action: the events of the zones now, in every language. */
export async function checkNow(monitor) {
  const { events, ok, stale } = await monitor.fresh();
  logger.info(
    `Check requested: ${ok ? `${events.length} event(s) in 24 h` : 'Brottsplatskartan unreachable'}`,
  );
  if (!ok) {
    return render(STATUS, 'apiDown');
  }
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      toast(events, language, formatTime(monitor.lastSuccessAt, language), stale),
    ]),
  );
}
