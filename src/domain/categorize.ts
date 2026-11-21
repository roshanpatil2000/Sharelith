import { categoryKeys, type CategoryKey } from '@/app/theme/colors';

/**
 * Words and phrases that pick a category from an expense's description.
 * Matching ignores case, punctuation and simple plurals. Phrases are tried
 * before single words (so "train ticket" is Travel even though "ticket" is
 * Entertainment), then categories in this order. No match: General.
 */
export const CATEGORY_KEYWORDS: Record<
  Exclude<CategoryKey, 'general'>,
  string[]
> = {
  food: [
    'breakfast',
    'brunch',
    'lunch',
    'dinner',
    'supper',
    'snack',
    'food',
    'meal',
    'restaurant',
    'cafe',
    'coffee',
    'chai',
    'tea',
    'juice',
    'dessert',
    'ice cream',
    'pizza',
    'burger',
    'biryani',
    'dosa',
    'thali',
    'sweets',
    'bakery',
    'cake',
    'swiggy',
    'zomato',
    "domino's",
    "mcdonald's",
    'kfc',
    'starbucks',
    'groceries',
    'grocery',
    'vegetables',
    'fruits',
    'milk',
    'bigbasket',
    'blinkit',
    'zepto',
    'instamart',
    'dmart',
  ],
  transport: [
    'taxi',
    'cab',
    'uber',
    'ola',
    'rapido',
    'auto',
    'rickshaw',
    'metro',
    'bus',
    'local train',
    'petrol',
    'diesel',
    'fuel',
    'cng',
    'ev charging',
    'parking',
    'toll',
    'fastag',
    'car wash',
    'bike service',
    'car service',
  ],
  travel: [
    'flight',
    'airfare',
    'airport',
    'train ticket',
    'irctc',
    'hotel',
    'hostel',
    'airbnb',
    'resort',
    'homestay',
    'booking',
    'makemytrip',
    'goibibo',
    'trip',
    'tour',
    'visa',
    'passport',
    'sightseeing',
    'luggage',
  ],
  home: [
    'rent',
    'deposit',
    'maintenance',
    'society',
    'furniture',
    'sofa',
    'mattress',
    'appliance',
    'repairs',
    'plumber',
    'electrician',
    'carpenter',
    'cleaning',
    'maid',
    'cook',
    'laundry',
    'household',
    'kitchen',
    'utensils',
    'ikea',
    'pepperfry',
    'urban company',
  ],
  utilities: [
    'electricity',
    'power bill',
    'water bill',
    'gas',
    'cylinder',
    'lpg',
    'internet',
    'wifi',
    'broadband',
    'mobile recharge',
    'recharge',
    'phone bill',
    'postpaid',
    'prepaid',
    'jio',
    'airtel',
    'vi',
    'bsnl',
    'dth',
    'tata play',
  ],
  entertainment: [
    'movie',
    'cinema',
    'film',
    'pvr',
    'inox',
    'bookmyshow',
    'concert',
    'show',
    'event',
    'tickets',
    'party',
    'drinks',
    'bar',
    'pub',
    'club',
    'beer',
    'game',
    'gaming',
    'bowling',
    'netflix',
    'prime video',
    'hotstar',
    'spotify',
    'youtube premium',
    'subscription',
  ],
  life: [
    'medicine',
    'pharmacy',
    'doctor',
    'hospital',
    'clinic',
    'dentist',
    'health',
    'insurance',
    'gym',
    'yoga',
    'salon',
    'haircut',
    'spa',
    'shopping',
    'clothes',
    'shoes',
    'amazon',
    'flipkart',
    'myntra',
    'gift',
    'birthday',
    'wedding',
    'donation',
    'fees',
    'tuition',
    'books',
    'stationery',
    'pet',
    'vet',
  ],
};

/** Lowercase words, apostrophes dropped ("Domino's" → "dominos"), other punctuation as spaces. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** A word and its likely singular forms, so plurals match either way. */
function forms(word: string): string[] {
  const out = [word];
  if (word.length > 3 && word.endsWith('ies')) {
    out.push(word.slice(0, -3) + 'y', word.slice(0, -1));
  }
  if (word.length > 3 && word.endsWith('es')) {
    out.push(word.slice(0, -2));
  }
  if (word.length > 2 && word.endsWith('s') && !word.endsWith('ss')) {
    out.push(word.slice(0, -1));
  }
  return out;
}

/** Whether two words match, allowing either to be a plural of the other. */
const same = (a: string, b: string) => forms(a).some(x => forms(b).includes(x));

type Rule = { category: Exclude<CategoryKey, 'general'>; words: string[] };

const RULES: Rule[] = (
  Object.entries(CATEGORY_KEYWORDS) as [Rule['category'], string[]][]
).flatMap(([category, list]) => list.map(k => ({ category, words: words(k) })));
// Longer phrases first; within a length, table order (stable sort).
const ORDERED = [...RULES].sort((a, b) => b.words.length - a.words.length);

/** The category an expense description suggests, or null if nothing matches. */
export function guessCategory(
  description: string,
): Exclude<CategoryKey, 'general'> | null {
  const text = words(description);
  for (const rule of ORDERED) {
    const n = rule.words.length;
    for (let i = 0; i + n <= text.length; i++) {
      if (rule.words.every((w, j) => same(w, text[i + j] ?? ''))) {
        return rule.category;
      }
    }
  }
  return null;
}

const LABELS: Record<CategoryKey, string> = {
  food: 'Food',
  home: 'Home',
  transport: 'Transport',
  entertainment: 'Entertainment',
  utilities: 'Utilities',
  life: 'Life',
  travel: 'Travel',
  general: 'General',
};

export const categoryLabel = (key: string): string =>
  LABELS[key as CategoryKey] ?? LABELS.general;

/** A saved category, or General for anything unknown. */
export const asCategoryKey = (key: string | null | undefined): CategoryKey =>
  (categoryKeys as readonly string[]).includes(key ?? '')
    ? (key as CategoryKey)
    : 'general';
