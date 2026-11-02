/**
 * UzHamyon AI Category Predictor
 *
 * Automatically predicts the most accurate category for a transaction based
 * on its title, description, or merchant name using instant bilingual semantic
 * matching (Uzbek Latin/Cyrillic, Russian, English) with AI fallbacks.
 */

export interface CategoryPrediction {
  category: string;
  confidence: number;
  isAiAuto: boolean;
}

// Semantic keywords dictionary mapped to standard UzHamyon categories
const EXPENSE_RULES: Array<{ category: string; keywords: string[] }> = [
  {
    category: 'Oziq-ovqat',
    keywords: [
      'korzinka', 'makro', 'havas', 'carrefour', 'baraka', 'magnum', 'bozor',
      'chorsu', 'oloy', 'mirobod', 'supermarket', 'market', 'magazin', 'gastronom',
      'non', 'nonvoy', 'sut', 'qatiq', 'go\'sht', 'gosht', 'go‘sht', 'lahm',
      'tuxum', 'meva', 'sabzavot', 'un', 'shakar', 'choy', 'oziq', 'bakkallik',
      'grocery', 'groceries', 'food', 'meat', 'bread', 'milk', 'cheese',
      'продукты', 'продуктовый', 'хлеб', 'молоко', 'мясо', 'сыр', 'базар', 'супермаркет'
    ],
  },
  {
    category: 'Kafeler va Restoranlar',
    keywords: [
      'kafe', 'cafe', 'coffee', 'kofe', 'choyxona', 'restoran', 'restaurant',
      'osh', 'oshxona', 'palov', 'somsa', 'manti', 'shashlik', 'kabob', 'lagmon',
      'lavash', 'evos', 'oqtepa', 'maxway', 'feedup', 'kfc', 'wendys', 'mcdonalds',
      'pizza', 'bellissimo', 'chopar', 'dodo', 'sushi', 'burger', 'hotdog',
      'tushlik', 'kechki ovqat', 'nonushta', 'lunch', 'dinner', 'breakfast',
      'fastfood', 'fast food', 'bar', 'pub', 'club', 'coffeebreak',
      'еда', 'кафе', 'ресторан', 'столовая', 'шашлык', 'пицца', 'бургер', 'додо'
    ],
  },
  {
    category: 'Transport',
    keywords: [
      'taksi', 'taxi', 'yandex', 'mytaxi', 'utaxi', 'indriver', 'inpost',
      'metro', 'avtobus', 'bus', 'marshrutka', 'tramvay', 'poyezd', 'samolyot',
      'benzin', 'zapravka', 'gaz', 'propan', 'metan', 'ai-92', 'ai-95', 'ai-98',
      'lukoil', 'ung', 'uzbekneftegaz', 'mustang', 'moyka', 'avtomoyka', 'avtoservis',
      'parking', 'parkovka', 'jarima', 'radar', 'yo\'l kira', 'yol kira', 'yo‘l kira',
      'bilet', 'afrosiyob', 'avia', 'uzairways', 'transport', 'car', 'fuel',
      'проезд', 'бензин', 'заправка', 'мойка', 'штраф', 'такси', 'метро', 'автобус'
    ],
  },
  {
    category: 'Uy-joy',
    keywords: [
      'ijara', 'kvartira', 'arenda', 'dom', 'uy', 'kvartplata', 'rieltor',
      'makler', 'mebel', 'remont', 'oboy', 'kraska', 'sement', 'xo\'jalik',
      'xojalik', 'uy-joy', 'rent', 'apartment', 'flat', 'home', 'furniture',
      'аренда', 'квартира', 'дом', 'ремонт', 'мебель', 'квартплата'
    ],
  },
  {
    category: 'Kommunal',
    keywords: [
      'kommunal', 'elektr', 'svet', 'tok', 'gaz', 'suv', 'vodokanal',
      'issiqlik', 'otopleniye', 'tbo', 'toza hudud', 'musor', 'chiqindi',
      'utilities', 'electricity', 'water', 'коммуналка', 'свет', 'вода', 'газ', 'отопление'
    ],
  },
  {
    category: 'Aloqa va Internet',
    keywords: [
      'internet', 'wi-fi', 'wifi', 'beeline', 'ucell', 'mobiuz', 'uztelecom',
      'uzonline', 'tcell', 'aloqa', 'megabayt', 'tarif', 'telefon', 'balans',
      'simkarta', 'comnet', 'sarkor', 'turon', 'fiber', 'telecom', 'mobile',
      'интернет', 'связь', 'телефон', 'вайфай', 'билайн', 'юселл'
    ],
  },
  {
    category: "Ko'ngilochar",
    keywords: [
      'kino', 'cinema', 'cinematica', 'riviera', 'magic city', 'seoul mun',
      'park', 'bog\'', 'konsert', 'teatr', 'o\'yin', 'game', 'steam', 'playstation',
      'ps5', 'ps4', 'netflix', 'spotify', 'yandex plus', 'youtube', 'pubg',
      'attraksion', 'bilyard', 'bouling', 'entertainment', 'concert', 'theatre',
      'кино', 'концерт', 'театр', 'игры', 'развлечения', 'парк', 'нетфликс'
    ],
  },
  {
    category: 'Xaridlar',
    keywords: [
      'xarid', 'kiyim', 'poyabzal', 'krossovka', 'shim', 'koylak', 'ko\'ylak',
      'kostyum', 'zara', 'mango', 'lc waikiki', 'defacto', 'terra pro', 'terrapro',
      'uzum', 'uzum market', 'olx', 'zoodmall', 'asaxiy', 'texnomart', 'mediapark',
      'elmakon', 'idea', 'elektronika', 'noutbuk', 'laptop', 'iphone', 'samsung',
      'shopping', 'clothes', 'shoes', 'mall', 'покупки', 'одежда', 'обувь', 'шопинг'
    ],
  },
  {
    category: 'Salomatlik',
    keywords: [
      'dorixona', 'apteka', 'dori', 'tabletka', 'shifoxona', 'poliklinika',
      'klinika', 'doktor', 'vrach', 'analiz', 'stomatolog', 'tish', 'ko\'z',
      'optika', 'vitamin', 'ukol', 'massaj', 'med', 'pharmacy', 'hospital',
      'doctor', 'dentist', 'medicine', 'health', 'аптека', 'лекарства', 'врач', 'больница'
    ],
  },
  {
    category: "Ta'lim",
    keywords: [
      'o\'qish', 'kurs', 'repititor', 'repetitor', 'dars', 'maktab', 'universitet',
      'institut', 'litsey', 'kollej', 'kontrakt', 'kitob', 'kitoblar', 'daftar',
      'o\'quv qurollari', 'ielts', 'toefl', 'sat', 'edumy', 'najot ta\'lim',
      'mohirdev', 'proweb', 'education', 'course', 'study', 'school', 'university',
      'учеба', 'курсы', 'книги', 'школа', 'университет', 'контракт', 'репетитор'
    ],
  },
  {
    category: 'Shaxsiy parvarish',
    keywords: [
      'sartarosh', 'barber', 'barbershop', 'go\'zallik', 'salon', 'soch', 'tirnoq',
      'manikyur', 'pedikyur', 'kosmetika', 'atir', 'parfyum', 'krem', 'shampun',
      'fitnes', 'gym', 'zal', 'basseyn', 'spa', 'beauty', 'fitness',
      'парикмахер', 'барбер', 'салон красоты', 'косметика', 'фитнес', 'спортзал'
    ],
  },
];

const INCOME_RULES: Array<{ category: string; keywords: string[] }> = [
  {
    category: 'Maosh',
    keywords: [
      'oylik', 'maosh', 'avans', 'ish haqi', 'ishhaqi', 'premiya', 'bonus',
      'oklad', 'zarplata', 'salary', 'wage', 'payroll', 'зарплата', 'оклад', 'аванс', 'премия'
    ],
  },
  {
    category: 'Frilans',
    keywords: [
      'frilans', 'freelance', 'zakaz', 'proyekt', 'loyiha', 'mijoz', 'klient',
      'gonorar', 'daryo', 'dizayn', 'dasturlash', 'sayt', 'bot', 'konsalting',
      'фриланс', 'проект', 'заказ', 'клиент', 'гонорар'
    ],
  },
  {
    category: 'Investitsiyalar',
    keywords: [
      'investitsiya', 'dividend', 'foiz', 'depozit', 'omonat', 'aksiya',
      'obligatsiya', 'kripto', 'crypto', 'binance', 'bybit', 'btc', 'usdt',
      'trading', 'invest', 'инвестиции', 'дивиденды', 'проценты', 'вклад', 'депозит'
    ],
  },
  {
    category: "Sovg'alar",
    keywords: [
      'sovg\'a', 'sovga', 'sovg‘a', 'hadya', 'tug\'ilgan kun', 'bayram',
      'to\'yona', 'toyona', 'suyunchi', 'yordam', 'grant', 'stipendiya',
      'gift', 'present', 'подарок', 'грант', 'стипендия'
    ],
  },
];

/**
 * Predicts category based on input text (title/description/merchant)
 */
export function predictCategoryFromTitle(
  text: string,
  type: 'expense' | 'income' | 'in' | 'ex' = 'expense'
): CategoryPrediction {
  const isIncome = type === 'income' || type === 'in';
  const clean = text
    .toLowerCase()
    .replace(/['`’‘]/g, "'")
    .replace(/[.,!?;:()]/g, ' ')
    .trim();

  if (!clean) {
    return {
      category: isIncome ? 'Maosh' : 'Oziq-ovqat',
      confidence: 0.5,
      isAiAuto: true,
    };
  }

  const rules = isIncome ? INCOME_RULES : EXPENSE_RULES;
  let bestMatch: { category: string; score: number } | null = null;

  for (const rule of rules) {
    for (const kw of rule.keywords) {
      const idx = clean.indexOf(kw);
      if (idx !== -1) {
        // Boundary checking: check if isolated word
        const isStart = idx === 0 || clean[idx - 1] === ' ';
        const isEnd = idx + kw.length === clean.length || clean[idx + kw.length] === ' ';
        const isWholeWord = isStart && isEnd;

        if (isWholeWord) {
          // Whole word match gets base 1000 + keyword length bonus + earlier position bonus
          const score = 1000 + kw.length * 10 + Math.max(0, 100 - idx) * 5;
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { category: rule.category, score };
          }
        } else if (kw.length >= 4) {
          // Substring match gets base 200 + position bonus
          const score = 200 + kw.length * 5 + Math.max(0, 100 - idx);
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { category: rule.category, score };
          }
        }
      }
    }
  }

  if (bestMatch) {
    return {
      category: bestMatch.category,
      confidence: 0.95,
      isAiAuto: true,
    };
  }

  // Fallback defaults if no specific keyword matches
  return {
    category: isIncome ? 'Maosh' : 'Oziq-ovqat',
    confidence: 0.6,
    isAiAuto: true,
  };
}

/**
 * Helper to match a predicted category name to a database Category item
 */
export function matchPredictedToDbCategory<T extends { id: string; name: string }>(
  predictedName: string,
  categories: T[]
): T | undefined {
  if (!categories.length) return undefined;

  const pred = predictedName.toLowerCase();

  // 1. Direct name match or includes
  const direct = categories.find((c) => {
    const cn = c.name.toLowerCase();
    return cn === pred || cn.includes(pred) || pred.includes(cn);
  });
  if (direct) return direct;

  // 2. Mapping to English system names if stored as English
  const SYSTEM_MAP: Record<string, string[]> = {
    'Oziq-ovqat': ['groceries', 'food'],
    'Kafeler va Restoranlar': ['dining', 'restaurant', 'cafe'],
    'Transport': ['transport', 'transit', 'car'],
    'Uy-joy': ['housing', 'rent', 'home'],
    'Kommunal': ['utilities', 'water', 'electric'],
    'Aloqa va Internet': ['internet', 'communication', 'phone'],
    "Ko'ngilochar": ['entertainment', 'fun'],
    'Xaridlar': ['shopping', 'clothes'],
    'Salomatlik': ['healthcare', 'health', 'medical'],
    "Ta'lim": ['education', 'study'],
    'Shaxsiy parvarish': ['personal', 'care', 'beauty'],
    'Maosh': ['salary', 'wage', 'payroll'],
    'Frilans': ['freelance', 'consulting'],
    'Investitsiyalar': ['investment', 'investments', 'dividend'],
    "Sovg'alar": ['gift', 'gifts', 'grant'],
  };

  const aliases = SYSTEM_MAP[predictedName] || [];
  for (const alias of aliases) {
    const found = categories.find((c) => c.name.toLowerCase().includes(alias));
    if (found) return found;
  }

  return categories[0];
}
