/** OSM-keukenwaarden → Nederlands label, familie (voor variatie en illustratie). */

export type Family =
  'asian' | 'italian' | 'shared' | 'grill' | 'green' | 'world' | 'european' | 'quick';

const C: Record<string, [label: string, family: Family]> = {
  italian: ['Italiaans', 'italian'],
  pizza: ['Pizza', 'italian'],
  pasta: ['Pasta', 'italian'],
  asian: ['Aziatisch', 'asian'],
  japanese: ['Japans', 'asian'],
  sushi: ['Sushi', 'asian'],
  ramen: ['Ramen', 'asian'],
  chinese: ['Chinees', 'asian'],
  thai: ['Thais', 'asian'],
  vietnamese: ['Vietnamees', 'asian'],
  korean: ['Koreaans', 'asian'],
  indonesian: ['Indonesisch', 'asian'],
  dim_sum: ['Dim sum', 'asian'],
  poke: ['Poké', 'asian'],
  indian: ['Indiaas', 'world'],
  nepalese: ['Nepalees', 'world'],
  pakistani: ['Pakistaans', 'world'],
  surinamese: ['Surinaams', 'world'],
  ethiopian: ['Ethiopisch', 'world'],
  african: ['Afrikaans', 'world'],
  mexican: ['Mexicaans', 'world'],
  peruvian: ['Peruaans', 'world'],
  argentinian: ['Argentijns', 'grill'],
  latin_american: ['Latijns-Amerikaans', 'world'],
  caribbean: ['Caribisch', 'world'],
  american: ['Amerikaans', 'grill'],
  tapas: ['Tapas', 'shared'],
  spanish: ['Spaans', 'shared'],
  mediterranean: ['Mediterraan', 'shared'],
  greek: ['Grieks', 'shared'],
  lebanese: ['Libanees', 'shared'],
  middle_eastern: ['Midden-Oosters', 'shared'],
  turkish: ['Turks', 'shared'],
  syrian: ['Syrisch', 'shared'],
  israeli: ['Israëlisch', 'shared'],
  moroccan: ['Marokkaans', 'shared'],
  french: ['Frans', 'european'],
  regional: ['Hollands', 'european'],
  dutch: ['Hollands', 'european'],
  international: ['Internationaal', 'european'],
  european: ['Europees', 'european'],
  portuguese: ['Portugees', 'european'],
  fine_dining: ['Fine dining', 'european'],
  seafood: ['Vis & zeevruchten', 'european'],
  fish: ['Vis', 'european'],
  steak_house: ['Steakhouse', 'grill'],
  barbecue: ['BBQ', 'grill'],
  grill: ['Grill', 'grill'],
  burger: ['Burgers', 'grill'],
  vegetarian: ['Vegetarisch', 'green'],
  vegan: ['Vegan', 'green'],
  salad: ['Salades', 'green'],
  sandwich: ['Broodjes', 'quick'],
  coffee_shop: ['Koffie', 'quick'],
  breakfast: ['Ontbijt', 'quick'],
  pancake: ['Pannenkoeken', 'quick'],
  ice_cream: ['IJs', 'quick'],
  kebab: ['Kebab', 'quick'],
  friture: ['Friet', 'quick'],
  chicken: ['Kip', 'quick'],
  bagel: ['Bagels', 'quick'],
  bubble_tea: ['Bubble tea', 'quick'],
};

/** Keukens die niet bij een avondetentje met een groep passen (lunch, snacks, ijs). */
export const NOT_FOR_DINNER = new Set([
  'sandwich',
  'coffee_shop',
  'breakfast',
  'pancake',
  'ice_cream',
  'kebab',
  'friture',
  'bagel',
  'bubble_tea',
  'chicken',
]);

export function cuisineLabel(key: string): string {
  return C[key]?.[0] ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function cuisineFamily(key: string | undefined): Family {
  return (key && C[key]?.[1]) || 'european';
}

/** Zoekt de OSM-sleutel bij een (Nederlands) label, bijv. "Koreaans" → "korean". */
export function cuisineKeyFromLabel(label: string): string | undefined {
  const l = label.trim().toLowerCase();
  if (C[l]) return l;
  return Object.keys(C).find((k) => C[k]![0].toLowerCase() === l);
}

export type Season = 'lente' | 'zomer' | 'herfst' | 'winter';

export function seasonOf(date: Date): Season {
  const m = Number(
    new Intl.DateTimeFormat('en-GB', { month: 'numeric', timeZone: 'Europe/Amsterdam' }).format(
      date,
    ),
  );
  if (m >= 3 && m <= 5) return 'lente';
  if (m >= 6 && m <= 8) return 'zomer';
  if (m >= 9 && m <= 11) return 'herfst';
  return 'winter';
}

/** Keukens die extra goed bij een seizoen passen, met de uitleg die de gebruiker ziet. */
export const SEASON_FIT: Record<Season, { keys: string[]; reason: string }> = {
  lente: {
    keys: [
      'mediterranean',
      'greek',
      'lebanese',
      'middle_eastern',
      'vegetarian',
      'vegan',
      'japanese',
      'sushi',
      'vietnamese',
      'israeli',
    ],
    reason: 'Frisse keuken voor de lente',
  },
  zomer: {
    keys: [
      'tapas',
      'spanish',
      'mediterranean',
      'greek',
      'italian',
      'seafood',
      'fish',
      'mexican',
      'peruvian',
      'portuguese',
    ],
    reason: 'Zomerse keuken',
  },
  herfst: {
    keys: [
      'french',
      'regional',
      'dutch',
      'italian',
      'indian',
      'steak_house',
      'surinamese',
      'indonesian',
      'argentinian',
      'ethiopian',
    ],
    reason: 'Stevige, warme keuken voor de herfst',
  },
  winter: {
    keys: [
      'ramen',
      'indian',
      'nepalese',
      'thai',
      'ethiopian',
      'french',
      'regional',
      'dutch',
      'steak_house',
      'indonesian',
      'korean',
    ],
    reason: 'Warme comfortkeuken voor de winter',
  },
};

/** Keukens die zich goed lenen voor samen delen met een grote groep. */
export const SHAREABLE = new Set([
  'tapas',
  'spanish',
  'mediterranean',
  'lebanese',
  'middle_eastern',
  'greek',
  'israeli',
  'asian',
  'dim_sum',
  'korean',
  'indonesian',
  'ethiopian',
  'turkish',
]);
