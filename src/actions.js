// -----------------------------------------------------------------------------
// The scene action `read_events` and the configuration action `check_now`.
// Both read Brottsplatskartan again when the last cycle is older than one
// interval, and answer with the events of the followed zones of the last 24
// hours as one sentence, newest first: something a scene can send by message
// or read aloud.
//
// The configuration action answers in a toast, cut by the core at 200
// characters: it names the two newest events only.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';
import { STATUS, formatTime, render, sentence } from './messages.js';

const logger = createLogger({ name: 'brottsplatskartan-actions' });

export const SCENE_ACTION = 'read_events';
export const CONFIG_ACTION = 'check_now';
export const TOAST_EVENTS = 2;

/** Scene action: outputs `text` and `count`; throws if Brottsplatskartan never answered. */
export async function readEvents(monitor) {
  const { events, ok } = await monitor.fresh();
  if (!ok) {
    throw new Error(render(STATUS, 'apiDown')[monitor.config.language]);
  }
  return {
    text: sentence(events, monitor.config.language),
    count: events.length,
  };
}

/** Configuration action: the events of the zones now, in every language. */
export async function checkNow(monitor) {
  const { events, ok } = await monitor.fresh();
  logger.info(
    `Check requested: ${ok ? `${events.length} event(s) in 24 h` : 'Brottsplatskartan unreachable'}`,
  );
  if (!ok) {
    return render(STATUS, 'apiDown');
  }
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      render(STATUS, 'summary', {
        text: sentence(events, language, TOAST_EVENTS),
        time: formatTime(monitor.lastSuccessAt, language),
      })[language],
    ]),
  );
}
