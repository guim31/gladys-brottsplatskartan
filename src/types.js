// -----------------------------------------------------------------------------
// The police event types (`title_type`, in Swedish, as the police writes them)
// sorted into a few broad categories, and translated into the four languages of
// the Gladys interface. The Swedish label is always kept next to the
// translation: it is the official one, and the one Brottsplatskartan shows.
//
// The list follows the types the police publishes (polisen.se) and the ones
// seen in the Brottsplatskartan data; an unknown type stays in Swedish and
// falls in "other". Summaries of a night or a day ("Sammanfattning natt") gather
// several events of a whole county: they are left out.
// -----------------------------------------------------------------------------

import { fold } from './config.js';

// Stable keys (scene trigger filter, feature keys): never renamed.
export const CATEGORIES = ['burglary', 'theft', 'violence', 'fire', 'traffic_accident', 'other'];

/** The category of a police event type, or null for a summary (left out). */
export function categoryOf(type) {
  const text = fold(type);
  if (text.startsWith('sammanfattning')) {
    return null;
  }
  if (text.includes('inbrott')) {
    return 'burglary';
  }
  if (text.includes('brand')) {
    return 'fire';
  }
  if (text.startsWith('trafikolycka')) {
    return 'traffic_accident';
  }
  if (
    /(^|[\s,/])ran($|[\s,])/.test(text) ||
    /misshandel|mord|drap|valdtakt|skottlossning|skjutning|olaga hot|vald\/hot|sexualbrott|sedlighetsbrott|explosion|detonation|sprangning|olaga frihetsberovande/.test(
      text,
    )
  ) {
    return 'violence';
  }
  if (/stold|snatteri|tillgrepp/.test(text)) {
    return 'theft';
  }
  return 'other';
}

/** "Trafikolycka,  personskada" → "Trafikolycka, personskada". */
export const cleanType = (type) =>
  String(type ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();

// [Swedish, English, French, German, Spanish]
const ROWS = [
  ['Alkohollagen', 'Alcohol Act', 'Loi sur l’alcool', 'Alkoholgesetz', 'Ley del alcohol'],
  [
    'Anträffad död',
    'Person found dead',
    'Personne retrouvée morte',
    'Tot aufgefunden',
    'Persona hallada muerta',
  ],
  ['Anträffat gods', 'Property found', 'Objets retrouvés', 'Fundsache', 'Objetos hallados'],
  [
    'Arbetsplatsolycka',
    'Workplace accident',
    'Accident du travail',
    'Arbeitsunfall',
    'Accidente laboral',
  ],
  ['Bedrägeri', 'Fraud', 'Escroquerie', 'Betrug', 'Estafa'],
  ['Bombhot', 'Bomb threat', 'Alerte à la bombe', 'Bombendrohung', 'Amenaza de bomba'],
  ['Brand', 'Fire', 'Incendie', 'Brand', 'Incendio'],
  [
    'Brand automatlarm',
    'Automatic fire alarm',
    'Alarme incendie automatique',
    'Automatischer Brandalarm',
    'Alarma automática de incendio',
  ],
  ['Bråk', 'Disturbance', 'Bagarre', 'Streit', 'Pelea'],
  ['Detonation', 'Detonation', 'Détonation', 'Detonation', 'Detonación'],
  ['Djur', 'Animal', 'Animal', 'Tier', 'Animal'],
  [
    'Efterlyst person',
    'Wanted person',
    'Personne recherchée',
    'Gesuchte Person',
    'Persona buscada',
  ],
  [
    'Farligt föremål, misstänkt',
    'Suspected dangerous object',
    'Objet dangereux suspect',
    'Verdächtiger gefährlicher Gegenstand',
    'Objeto peligroso sospechoso',
  ],
  ['Fjällräddning', 'Mountain rescue', 'Secours en montagne', 'Bergrettung', 'Rescate de montaña'],
  ['Fylleri', 'Drunkenness', 'Ivresse', 'Trunkenheit', 'Embriaguez'],
  ['Fylleri/LOB', 'Drunkenness', 'Ivresse', 'Trunkenheit', 'Embriaguez'],
  ['Förfalskningsbrott', 'Forgery', 'Faux et usage de faux', 'Fälschung', 'Falsificación'],
  [
    'Försvunnen person',
    'Missing person',
    'Personne disparue',
    'Vermisste Person',
    'Persona desaparecida',
  ],
  [
    'Gränskontroll',
    'Border control',
    'Contrôle aux frontières',
    'Grenzkontrolle',
    'Control fronterizo',
  ],
  ['Hemfridsbrott', 'Trespass', 'Violation de domicile', 'Hausfriedensbruch', 'Allanamiento'],
  ['Häleri', 'Handling stolen goods', 'Recel', 'Hehlerei', 'Receptación'],
  ['Inbrott', 'Burglary', 'Cambriolage', 'Einbruch', 'Robo con allanamiento'],
  [
    'Inbrott, försök',
    'Attempted burglary',
    'Tentative de cambriolage',
    'Einbruchsversuch',
    'Intento de robo con allanamiento',
  ],
  ['Knivlagen', 'Knife Act', 'Port de couteau', 'Messergesetz', 'Ley de armas blancas'],
  ['Kontroll', 'Check', 'Contrôle', 'Kontrolle', 'Control'],
  [
    'Kontroll person/fordon',
    'Person or vehicle check',
    'Contrôle de personne ou de véhicule',
    'Personen- oder Fahrzeugkontrolle',
    'Control de persona o vehículo',
  ],
  ['Larm inbrott', 'Burglar alarm', 'Alarme intrusion', 'Einbruchalarm', 'Alarma de robo'],
  ['Larm överfall', 'Panic alarm', 'Alarme agression', 'Überfallalarm', 'Alarma de atraco'],
  ['Luftfartslagen', 'Aviation Act', 'Loi sur l’aviation', 'Luftfahrtgesetz', 'Ley de aviación'],
  [
    'Miljöbrott',
    'Environmental crime',
    'Délit environnemental',
    'Umweltdelikt',
    'Delito ambiental',
  ],
  [
    'Missbruk av urkund',
    'Misuse of documents',
    'Usage abusif de document',
    'Urkundenmissbrauch',
    'Uso indebido de documentos',
  ],
  ['Misshandel', 'Assault', 'Agression', 'Körperverletzung', 'Agresión'],
  [
    'Misshandel, grov',
    'Aggravated assault',
    'Agression grave',
    'Schwere Körperverletzung',
    'Agresión grave',
  ],
  [
    'Mord/dråp',
    'Murder or manslaughter',
    'Meurtre ou homicide',
    'Mord oder Totschlag',
    'Asesinato u homicidio',
  ],
  [
    'Mord/dråp, försök',
    'Attempted murder',
    'Tentative de meurtre',
    'Mordversuch',
    'Intento de asesinato',
  ],
  ['Mordbrand', 'Arson', 'Incendie criminel', 'Brandstiftung', 'Incendio provocado'],
  [
    'Motorfordon, anträffat stulet',
    'Stolen vehicle found',
    'Véhicule volé retrouvé',
    'Gestohlenes Fahrzeug gefunden',
    'Vehículo robado hallado',
  ],
  [
    'Motorfordon, stöld',
    'Vehicle theft',
    'Vol de véhicule',
    'Fahrzeugdiebstahl',
    'Robo de vehículo',
  ],
  [
    'Narkotikabrott',
    'Drug offence',
    'Infraction à la législation sur les stupéfiants',
    'Drogendelikt',
    'Delito de drogas',
  ],
  [
    'Naturkatastrof',
    'Natural disaster',
    'Catastrophe naturelle',
    'Naturkatastrophe',
    'Catástrofe natural',
  ],
  [
    'Ofog barn/ungdom',
    'Mischief by youths',
    'Incivilités de jeunes',
    'Unfug von Jugendlichen',
    'Gamberradas de jóvenes',
  ],
  [
    'Ofredande/förargelse',
    'Harassment or public nuisance',
    'Harcèlement ou trouble',
    'Belästigung',
    'Acoso o molestias',
  ],
  [
    'Olaga frihetsberövande',
    'Unlawful detention',
    'Séquestration',
    'Freiheitsberaubung',
    'Detención ilegal',
  ],
  ['Olaga hot', 'Unlawful threat', 'Menaces', 'Bedrohung', 'Amenazas'],
  ['Olaga intrång', 'Unlawful intrusion', 'Intrusion', 'Unbefugtes Eindringen', 'Intrusión ilegal'],
  [
    'Olaga intrång/hemfridsbrott',
    'Trespass',
    'Violation de domicile',
    'Hausfriedensbruch',
    'Allanamiento',
  ],
  [
    'Olovlig körning',
    'Unlicensed driving',
    'Conduite sans permis',
    'Fahren ohne Fahrerlaubnis',
    'Conducción sin permiso',
  ],
  [
    'Ordningslagen',
    'Public Order Act',
    'Trouble à l’ordre public',
    'Ordnungsgesetz',
    'Ley de orden público',
  ],
  [
    'Polisinsats/kommendering',
    'Police operation',
    'Opération de police',
    'Polizeieinsatz',
    'Operación policial',
  ],
  [
    'Rattfylleri',
    'Drink or drug driving',
    'Conduite sous influence',
    'Trunkenheit am Steuer',
    'Conducción bajo los efectos',
  ],
  [
    'Räddningsinsats',
    'Rescue operation',
    'Opération de secours',
    'Rettungseinsatz',
    'Operación de rescate',
  ],
  ['Rån', 'Robbery', 'Vol avec violence', 'Raub', 'Atraco'],
  ['Rån väpnat', 'Armed robbery', 'Vol à main armée', 'Bewaffneter Raub', 'Atraco a mano armada'],
  [
    'Rån, försök',
    'Attempted robbery',
    'Tentative de vol avec violence',
    'Raubversuch',
    'Intento de atraco',
  ],
  ['Rån övrigt', 'Robbery', 'Vol avec violence', 'Raub', 'Atraco'],
  [
    'Sedlighetsbrott',
    'Indecency offence',
    'Atteinte aux mœurs',
    'Sittlichkeitsdelikt',
    'Delito contra la decencia',
  ],
  ['Sexualbrott', 'Sexual offence', 'Infraction sexuelle', 'Sexualdelikt', 'Delito sexual'],
  [
    'Sjukdom/olycksfall',
    'Illness or accident',
    'Malaise ou accident',
    'Krankheit oder Unfall',
    'Enfermedad o accidente',
  ],
  ['Sjölagen', 'Maritime Act', 'Loi maritime', 'Seegesetz', 'Ley marítima'],
  ['Skadegörelse', 'Criminal damage', 'Dégradation', 'Sachbeschädigung', 'Daños'],
  ['Skottlossning', 'Shooting', 'Coups de feu', 'Schüsse', 'Tiroteo'],
  [
    'Skottlossning, misstänkt',
    'Suspected shooting',
    'Coups de feu suspectés',
    'Mutmaßliche Schüsse',
    'Posible tiroteo',
  ],
  ['Stöld', 'Theft', 'Vol', 'Diebstahl', 'Robo'],
  ['Stöld, försök', 'Attempted theft', 'Tentative de vol', 'Diebstahlsversuch', 'Intento de robo'],
  ['Stöld, ringa', 'Petty theft', 'Vol simple', 'Geringfügiger Diebstahl', 'Hurto menor'],
  [
    'Stöld/inbrott',
    'Theft or burglary',
    'Vol ou cambriolage',
    'Diebstahl oder Einbruch',
    'Robo o allanamiento',
  ],
  [
    'Trafikbrott',
    'Traffic offence',
    'Infraction routière',
    'Verkehrsdelikt',
    'Infracción de tráfico',
  ],
  [
    'Trafikhinder',
    'Traffic obstruction',
    'Gêne à la circulation',
    'Verkehrsbehinderung',
    'Obstáculo en la vía',
  ],
  [
    'Trafikkontroll',
    'Traffic check',
    'Contrôle routier',
    'Verkehrskontrolle',
    'Control de tráfico',
  ],
  [
    'Trafikolycka',
    'Road accident',
    'Accident de la route',
    'Verkehrsunfall',
    'Accidente de tráfico',
  ],
  [
    'Trafikolycka, personskada',
    'Road accident with injuries',
    'Accident de la route avec blessés',
    'Verkehrsunfall mit Verletzten',
    'Accidente de tráfico con heridos',
  ],
  [
    'Trafikolycka, singel',
    'Single-vehicle accident',
    'Accident de la route sans tiers',
    'Alleinunfall',
    'Accidente de un solo vehículo',
  ],
  [
    'Trafikolycka, smitning från',
    'Hit and run',
    'Délit de fuite',
    'Unfallflucht',
    'Accidente con fuga',
  ],
  [
    'Trafikolycka, vilt',
    'Collision with wildlife',
    'Collision avec un animal sauvage',
    'Wildunfall',
    'Colisión con fauna',
  ],
  ['Utlänningslagen', 'Aliens Act', 'Droit des étrangers', 'Ausländergesetz', 'Ley de extranjería'],
  ['Vapenlagen', 'Weapons Act', 'Législation sur les armes', 'Waffengesetz', 'Ley de armas'],
  [
    'Varningslarm/haveri',
    'Warning alarm or breakdown',
    'Alerte ou avarie',
    'Warnalarm oder Havarie',
    'Alarma o avería',
  ],
  [
    'Våld/hot mot tjänsteman',
    'Violence or threat against an official',
    'Violence ou menace envers un agent',
    'Gewalt oder Drohung gegen Beamte',
    'Violencia o amenaza contra un funcionario',
  ],
  ['Våldtäkt', 'Rape', 'Viol', 'Vergewaltigung', 'Violación'],
  [
    'Våldtäkt, försök',
    'Attempted rape',
    'Tentative de viol',
    'Versuchte Vergewaltigung',
    'Intento de violación',
  ],
  [
    'Vållande till kroppsskada',
    'Causing bodily injury',
    'Blessures involontaires',
    'Fahrlässige Körperverletzung',
    'Lesiones imprudentes',
  ],
  ['Övrigt', 'Other', 'Autre', 'Sonstiges', 'Otros'],
];

const INDEX = { en: 1, fr: 2, de: 3, es: 4 };

// Keyed by the folded Swedish label: the police is not consistent with accents and spaces.
export const TYPE_NAMES = new Map(ROWS.map((row) => [fold(row[0]), row]));
export const TYPE_ROWS = ROWS;

/** The type translated, or null when it is not in the list. */
export function translateType(type, language) {
  const row = TYPE_NAMES.get(fold(cleanType(type)));
  return row ? row[INDEX[language] ?? 1] : null;
}

/** "Cambriolage (Inbrott)"; the Swedish label alone when unknown or identical. */
export function typeLabel(type, language) {
  const swedish = cleanType(type);
  const translated = translateType(swedish, language);
  if (!translated || fold(translated) === fold(swedish)) {
    return swedish;
  }
  return `${translated} (${swedish})`;
}
