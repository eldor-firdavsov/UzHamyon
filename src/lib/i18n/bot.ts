/**
 * Telegram bot texts in Uzbek, Russian and English (HTML parse mode).
 * Every dynamic value is escaped here, so callers pass raw names and descriptions.
 * Plain module: used by the bot, the cron jobs and node tests.
 */

import type { Lang } from './config.ts';
import { escapeHtml } from '../telegram/html.ts';
import { formatMoneyIn } from './format.ts';

export const MAX_VOICE_SECONDS = 60;
const MAX_ACTIONS = 10;
const BOT = 'uz_hamyonbot';

export interface DeletionCounts {
  transactions: number;
  goals: number;
  budgets: number;
  categories: number;
}

/** An executed AI action, enough to describe it to the user. */
export interface DescribableAction {
  actionType: string;
  transactionType?: string;
  amount: number;
  currency?: string;
  description?: string;
  goalName?: string;
  targetAmount?: number;
}

const uz = {
  fallbackName: 'aziz foydalanuvchi',
  openApp: 'Ilovani ochish',
  openUzHamyon: "UzHamyon'ni ochish",
  addInApp: '➕ Ilovada qo‘shish',
  openUzHamyonRocket: "🚀 UzHamyon'ni ochish",
  openGoal: 'Maqsadni ochish',
  chooseLanguage: '🌐 <b>Tilni tanlang</b>\nВыберите язык · Choose your language',
  languageSaved: '✅ Til: O‘zbekcha',
  welcomeNew: (name: string) =>
    `<b>Assalomu alaykum, ${escapeHtml(name)}!</b>\n\nUzHamyon — xarajatlaringizni 5 soniyada yozib boradigan hamyon.\n\n✍️ Shu chatga yozing: <code>taksi 20000</code>\n🎤 Yoki ovozli xabar yuboring.\n\nYoki pastdagi tugma bilan ilovani oching 👇`,
  welcomeReturning: (name: string) =>
    `<b>Qaytganingizdan xursandmiz, ${escapeHtml(name)}!</b>\n\nUzHamyon tayyor. Moliyaviy holatingizni davom ettiring.\n\n🎤 Ovozli xabar yuborishingiz ham mumkin — masalan: «bugun tushlikka 45 ming sarfladim».`,
  appMsg: 'UzHamyon ilovasini ochish uchun quyidagi tugmani bosing:',
  help: `<b>UzHamyon — shaxsiy moliyaviy yordamchingiz.</b>\n\n<b>Mavjud buyruqlar:</b>\n/start — UzHamyonni boshlash\n/app — Ilovani ochish\n/language — Tilni o‘zgartirish\n/help — Yordam ma’lumotlari\n/about — UzHamyon haqida\n/delete — Barcha ma’lumotlarimni o‘chirish\n\nShuningdek, tabiiy tilda xabar yozishingiz mumkin:\n• <i>«Bugun tushlikka 45 000 so'm ishlatdim»</i>\n• <i>«Oylik maoshim 5 000 000 so'm tushdi»</i>\n• <i>«Mashina uchun 50 mln maqsad yarat»</i>\n• <i>«Bu oy qancha pul sarfladim?»</i>\n\n🎤 Ovozli xabar yuborishingiz ham mumkin (${MAX_VOICE_SECONDS} soniyagacha): o‘zbekcha, ruscha yoki aralash gapiring — masalan, «bugun tushlikka 45 ming, taksiga 15 ming».`,
  about: `<b>UzHamyon haqida</b>\n\nUzHamyon — O‘zbekiston foydalanuvchilari uchun shaxsiy moliya va budjet boshqaruvi tizimi.\n\nDaromad va xarajatlaringizni kuzatib boring, jamg‘arma maqsadlaringizni belgilang va sun’iy intellekt (UzHamyon AI) tavsiyalaridan foydalaning.\n\nBarcha ma’lumotlaringiz xavfsiz va shifrlangan holatda saqlanadi.`,
  groupNote: `Men faqat shaxsiy chatda ishlayman — moliyaviy ma’lumotlaringiz xavfsizligi uchun. 🙂\n👉 t.me/${BOT}`,
  aiRetry: '⏳ Kechirasiz, hozir xabaringizni tahlil qila olmadim. Iltimos, birozdan so‘ng qayta yozib ko‘ring.',
  confirm: '✅ Tasdiqlash',
  cancel: '❌ Bekor qilish',
  cancelled: '❌ Amal bekor qilindi. Hech qanday moliyaviy yozuv kiritilmadi.',
  alreadySaved: '✅ Bu amal allaqachon saqlangan.',
  wasCancelled: '❌ Bu amal bekor qilingan. Hech qanday moliyaviy yozuv kiritilmadi.',
  executing: '⏳ Bu amal hozir saqlanmoqda. Birozdan so‘ng ilovada tekshirib ko‘ring.',
  failedRetry: '⚠️ Bu amalni saqlab bo‘lmagan edi. Iltimos, qayta urinib ko‘ring.',
  expired: '⌛ Bu taklifning muddati tugagan (15 daqiqa). Iltimos, xabaringizni qayta yuboring.',
  saving: '⏳ <i>Saqlanmoqda...</i>',
  accountNotFound: '⚠️ Foydalanuvchi hisobi topilmadi. Avval ilovani oching.',
  unauthorized: '⛔ Ruxsat berilmagan: bu amal boshqa foydalanuvchiga tegishli.',
  actionNotFound: '⚠️ Tasdiqlanuvchi amal topilmadi.',
  cancelNotFound: '⚠️ Bekor qilinadigan amal topilmadi.',
  errorOccurred: (msg: string) => `⚠️ Xatolik yuz berdi: ${escapeHtml(msg)}`,
  couldNotSave: 'Saqlab bo‘lmadi',
  couldNotCancel: 'Amalni bekor qilib bo‘lmadi.',
  streakLine: (n: number) => `🔥 ${n} kun ketma-ket!`,
  saved: '✅ Saqlandi.',
  noActiveProposal: '⌛ Tasdiqlanadigan faol taklif topilmadi (muddati tugagan bo‘lishi mumkin). Iltimos, xabaringizni qayta yuboring.',
  checking: '⏳ Tekshirilmoqda...',
  listening: '🎤 Ovozli xabar tinglanmoqda...',
  openAccount: (name: string) =>
    `Assalomu alaykum, ${escapeHtml(name)}!\n\nUzHamyon ilovasi orqali hisobingizni ochish uchun quyidagi tugmani bosing:`,
  updating: '⚠️ Tizimda yangilanishlar bajarilmoqda. Iltimos, keyinroq qayta urinib ko‘ring.',
  actionSaveFailed: '⚠️ Amalni saqlab bo‘lmadi. Iltimos, birozdan so‘ng qayta urinib ko‘ring.',
  clarifyDefault: 'Iltimos, summani yoki boshqa tafsilotlarni aniqlashtirib yozing.',
  queryFailed: 'Moliyaviy ma’lumotlarni tahlil qilishda xatolik yuz berdi.',
  chatDefault: (name: string) => `Assalomu alaykum, ${escapeHtml(name)}! Sizga qanday yordam bera olaman?`,
  youSaid: (transcript: string) => `🎤 <i>Siz aytdingiz:</i> «${escapeHtml(transcript)}»\n\n`,
  voice: {
    tooLong: `🎤 Ovozli xabar juda uzun. Iltimos, ${MAX_VOICE_SECONDS} soniyadan qisqaroq yozib yuboring.`,
    tooLarge: '🎤 Fayl juda katta. Iltimos, qisqaroq ovozli xabar yuboring.',
    unsupported: '🎤 Bu audio formatini o‘qiy olmayman. Iltimos, oddiy ovozli xabar yuboring yoki yozib yuboring.',
    notUnderstood: 'Ovozli xabarni tushunib bo‘lmadi, iltimos yozib yuboring.',
    videoNote: '🎥 Video-xabarlarni hali tushuna olmayman. Iltimos, ovozli xabar yoki matn yuboring.',
  },
  deletion: {
    prompt: (c: DeletionCounts) =>
      '🗑 <b>Barcha ma’lumotlaringizni o‘chirmoqchimisiz?</b>\n\n' +
      'Quyidagilar butunlay o‘chiriladi:\n' +
      `• ${c.transactions} ta tranzaksiya (daromad va xarajat)\n` +
      `• ${c.goals} ta maqsad va jamg‘arma tarixi\n` +
      `• ${c.budgets} ta budjet\n` +
      `• ${c.categories} ta shaxsiy kategoriya\n` +
      '• AI suhbatlar, eslatma sozlamalari va profilingiz\n\n' +
      '⚠️ <b>Bu amalni qaytarib bo‘lmaydi.</b> Tasdiqlash tugmasi 5 daqiqa amal qiladi.',
    confirmBtn: '🗑 Ha, hammasini o‘chirish',
    cancelBtn: '❌ Bekor qilish',
    deleting: '⏳ Ma’lumotlaringiz o‘chirilmoqda...',
    done: '✅ Barcha ma’lumotlaringiz o‘chirildi.\n\nUzHamyon’dan foydalanganingiz uchun rahmat. Qaytmoqchi bo‘lsangiz, /start bosing — yangi, bo‘sh hisob ochiladi.',
    cancelled: '👌 Bekor qilindi. Ma’lumotlaringiz joyida qoldi.',
    expired: '⌛ Tasdiqlash muddati tugagan (5 daqiqa). Qaytadan /delete yuboring.',
    invalid: '⛔ Bu tugma sizga tegishli emas.',
    failed: '⚠️ Ma’lumotlarni o‘chirib bo‘lmadi. Iltimos, birozdan so‘ng qayta urinib ko‘ring.',
    notFound: 'ℹ️ Sizda saqlangan ma’lumot topilmadi.',
  },
  goalCompleted: (goal: string) =>
    `🎉 <b>Tabriklaymiz!</b> «${escapeHtml(goal)}» maqsadingizga yetdingiz!\n\nAjoyib natija — shu ruhda davom eting! 💪`,
  goalDeadline: (goal: string, date: string) =>
    `⏰ «${escapeHtml(goal)}» maqsadingiz muddati (${escapeHtml(date)}) o‘tdi, lekin u hali yakunlanmagan.\n\n` +
    `Hech gap yo‘q — yangi sana belgilab, davom ettirishingiz mumkin. Ilovada maqsadni oching va «Tahrirlash» orqali yangi muddat qo‘ying. 🙂`,
  reminder: (name: string) =>
    `Salom, <b>${escapeHtml(name)}</b>! 👋\n\nBugungi o‘tkazmalarni ilovaga kiritishni unutmang yoki shunchaki bugungi o‘tkazmalaringizni shu chatga yozib qo‘ying! ✍️`,
  firstEntryReminder: (name: string) =>
    `Salom, <b>${escapeHtml(name)}</b>! 👋\n\nBirinchi xarajatingizni yozing — 5 soniya. Shu chatga yuboring:\n\n<code>non 8000</code>\n\nQolganini o‘zim qilaman 🔥`,
  registrationDone: (name: string) =>
    [
      `✅ <b>Tayyor, ${escapeHtml(name)}!</b>`,
      '',
      'Xarajatni shu chatga yozing — o‘zim qo‘shaman:',
      '<code>taksi 20000</code>',
      '<code>tushlik 45 ming</code>',
      '',
      '🎤 Ovozli xabar ham bo‘ladi.',
    ].join('\n'),
  tooManyActions: `Bitta xabarda ko‘pi bilan ${MAX_ACTIONS} ta amal yozish mumkin. Iltimos, xabarni bir nechta qismga bo‘lib yuboring. 🙏`,
  amountTooLarge:
    'Summa juda katta ko‘rinadi (bitta amal uchun eng ko‘pi 1 000 000 000 so‘m yoki 100 000 dollar). Iltimos, summani tekshirib, qayta yozing.',
  executedHeader: '✅ Muvaffaqiyatli bajarildi:',
  executedTx: (desc: string, money: string, income: boolean) => `${desc} (${money} ${income ? 'daromad' : 'xarajat'})`,
  executedGoalCreated: (goal: string, money: string) => `«${goal}» jamg‘arma maqsadi (${money})`,
  executedGoalUpdated: (goal: string, money: string) => `«${goal}» maqsadi yangilandi (yangi summa: ${money})`,
  executedContribution: (goal: string, money: string) => `«${goal}» maqsadiga ${money} qo‘shildi`,
  confirmTx: (money: string, income: boolean, desc: string) =>
    `${money} miqdorida ${income ? 'daromadni' : 'xarajatni'} («${desc}») qayd etishni tasdiqlaysizmi?`,
  confirmGoalCreate: (goal: string, money: string) => `«${goal}» uchun ${money} jamg‘arma maqsadini yaratishni tasdiqlaysizmi?`,
  confirmGoalUpdate: (goal: string, money: string) => `«${goal}» maqsadi miqdorini ${money}ga o‘zgartirishni tasdiqlaysizmi?`,
  confirmContribution: (goal: string, money: string) => `«${goal}» maqsadiga ${money} qo‘shishni tasdiqlaysizmi?`,
  confirmMany: (n: number) => `Quyidagi ${n} ta operatsiyani qayd etishni tasdiqlaysizmi?`,
  lineIncome: 'Daromad',
  lineExpense: 'Xarajat',
  savingsGoal: 'Jamg‘arma',
  confirmGeneric: 'Iltimos, ma’lumotingizni tasdiqlang.',
  writeSomething: 'Iltimos, xabaringizni yozing.',
  received: 'Xabaringiz qabul qilindi.',
  cancelledWeb: 'Amal bekor qilindi. Hech qanday moliyaviy yozuv kiritilmadi.',
  rateNote: (rate: string) => `(1 $ = ${rate} so‘m kursi bo‘yicha)`,
  /** Line added to AI prompts: the language of every user-facing text. */
  aiLanguageRule: 'Foydalanuvchiga yoziladigan barcha matnlarni sodda, ravon o‘zbek tilida yozing. Summalarda "so‘m" so‘zini ishlating.',
};

export type BotTexts = typeof uz;

const ru: BotTexts = {
  fallbackName: 'друг',
  openApp: 'Открыть приложение',
  openUzHamyon: 'Открыть UzHamyon',
  addInApp: '➕ Добавить в приложении',
  openUzHamyonRocket: '🚀 Открыть UzHamyon',
  openGoal: 'Открыть цель',
  chooseLanguage: uz.chooseLanguage,
  languageSaved: '✅ Язык: русский',
  welcomeNew: (name: string) =>
    `<b>Здравствуйте, ${escapeHtml(name)}!</b>\n\nUzHamyon — кошелёк, в который расходы записываются за 5 секунд.\n\n✍️ Напишите в этот чат: <code>такси 20000</code>\n🎤 Или отправьте голосовое сообщение.\n\nИли откройте приложение кнопкой ниже 👇`,
  welcomeReturning: (name: string) =>
    `<b>Рады, что вы вернулись, ${escapeHtml(name)}!</b>\n\nUzHamyon готов. Продолжайте вести финансы.\n\n🎤 Можно отправить и голосовое — например: «сегодня потратил 45 тысяч на обед».`,
  appMsg: 'Нажмите кнопку ниже, чтобы открыть приложение UzHamyon:',
  help: `<b>UzHamyon — ваш личный финансовый помощник.</b>\n\n<b>Команды:</b>\n/start — начать работу с UzHamyon\n/app — открыть приложение\n/language — сменить язык\n/help — справка\n/about — о UzHamyon\n/delete — удалить все мои данные\n\nМожно писать обычным текстом:\n• <i>«Сегодня потратил 45 000 сум на обед»</i>\n• <i>«Пришла зарплата 5 000 000 сум»</i>\n• <i>«Создай цель 50 млн на машину»</i>\n• <i>«Сколько я потратил в этом месяце?»</i>\n\n🎤 Можно отправить голосовое (до ${MAX_VOICE_SECONDS} секунд) на русском, узбекском или вперемешку — например, «обед 45 тысяч, такси 15 тысяч».`,
  about: `<b>О UzHamyon</b>\n\nUzHamyon — сервис учёта личных финансов и бюджета для пользователей в Узбекистане.\n\nСледите за доходами и расходами, ставьте цели накоплений и получайте советы искусственного интеллекта (UzHamyon AI).\n\nВсе ваши данные хранятся надёжно и в зашифрованном виде.`,
  groupNote: `Я работаю только в личном чате — ради безопасности ваших финансовых данных. 🙂\n👉 t.me/${BOT}`,
  aiRetry: '⏳ Извините, сейчас не получилось разобрать сообщение. Попробуйте написать чуть позже.',
  confirm: '✅ Подтвердить',
  cancel: '❌ Отмена',
  cancelled: '❌ Действие отменено. Никаких финансовых записей не добавлено.',
  alreadySaved: '✅ Это уже сохранено.',
  wasCancelled: '❌ Это действие отменено. Никаких финансовых записей не добавлено.',
  executing: '⏳ Сохраняем прямо сейчас. Проверьте в приложении чуть позже.',
  failedRetry: '⚠️ Не удалось сохранить. Попробуйте ещё раз.',
  expired: '⌛ Срок предложения истёк (15 минут). Отправьте сообщение ещё раз.',
  saving: '⏳ <i>Сохраняем...</i>',
  accountNotFound: '⚠️ Аккаунт не найден. Сначала откройте приложение.',
  unauthorized: '⛔ Нет доступа: это действие принадлежит другому пользователю.',
  actionNotFound: '⚠️ Действие для подтверждения не найдено.',
  cancelNotFound: '⚠️ Действие для отмены не найдено.',
  errorOccurred: (msg: string) => `⚠️ Произошла ошибка: ${escapeHtml(msg)}`,
  couldNotSave: 'Не удалось сохранить',
  couldNotCancel: 'Не удалось отменить действие.',
  streakLine: (n: number) => `🔥 ${n} дн. подряд!`,
  saved: '✅ Сохранено.',
  noActiveProposal: '⌛ Нет активного предложения для подтверждения (возможно, срок истёк). Отправьте сообщение ещё раз.',
  checking: '⏳ Проверяем...',
  listening: '🎤 Слушаем голосовое...',
  openAccount: (name: string) =>
    `Здравствуйте, ${escapeHtml(name)}!\n\nЧтобы открыть свой аккаунт в UzHamyon, нажмите кнопку ниже:`,
  updating: '⚠️ Идёт обновление системы. Попробуйте позже.',
  actionSaveFailed: '⚠️ Не удалось сохранить действие. Попробуйте чуть позже.',
  clarifyDefault: 'Уточните, пожалуйста, сумму или другие детали.',
  queryFailed: 'Не удалось проанализировать финансовые данные.',
  chatDefault: (name: string) => `Здравствуйте, ${escapeHtml(name)}! Чем могу помочь?`,
  youSaid: (transcript: string) => `🎤 <i>Вы сказали:</i> «${escapeHtml(transcript)}»\n\n`,
  voice: {
    tooLong: `🎤 Голосовое слишком длинное. Запишите, пожалуйста, короче ${MAX_VOICE_SECONDS} секунд.`,
    tooLarge: '🎤 Файл слишком большой. Отправьте голосовое покороче.',
    unsupported: '🎤 Не могу прочитать этот формат аудио. Отправьте обычное голосовое или напишите текстом.',
    notUnderstood: 'Не удалось разобрать голосовое, напишите, пожалуйста, текстом.',
    videoNote: '🎥 Видеосообщения я пока не понимаю. Отправьте голосовое или текст.',
  },
  deletion: {
    prompt: (c: DeletionCounts) =>
      '🗑 <b>Удалить все ваши данные?</b>\n\n' +
      'Будет удалено безвозвратно:\n' +
      `• операций (доходы и расходы): ${c.transactions}\n` +
      `• целей с историей накоплений: ${c.goals}\n` +
      `• бюджетов: ${c.budgets}\n` +
      `• своих категорий: ${c.categories}\n` +
      '• чаты с AI, настройки напоминаний и ваш профиль\n\n' +
      '⚠️ <b>Это действие нельзя отменить.</b> Кнопка подтверждения действует 5 минут.',
    confirmBtn: '🗑 Да, удалить всё',
    cancelBtn: '❌ Отмена',
    deleting: '⏳ Удаляем ваши данные...',
    done: '✅ Все ваши данные удалены.\n\nСпасибо, что пользовались UzHamyon. Захотите вернуться — нажмите /start, откроется новый пустой аккаунт.',
    cancelled: '👌 Отменено. Ваши данные на месте.',
    expired: '⌛ Время на подтверждение истекло (5 минут). Отправьте /delete ещё раз.',
    invalid: '⛔ Эта кнопка не для вас.',
    failed: '⚠️ Не удалось удалить данные. Попробуйте чуть позже.',
    notFound: 'ℹ️ Сохранённых данных не найдено.',
  },
  goalCompleted: (goal: string) =>
    `🎉 <b>Поздравляем!</b> Вы достигли цели «${escapeHtml(goal)}»!\n\nОтличный результат — так держать! 💪`,
  goalDeadline: (goal: string, date: string) =>
    `⏰ Срок цели «${escapeHtml(goal)}» (${escapeHtml(date)}) прошёл, но она ещё не достигнута.\n\n` +
    `Ничего страшного — поставьте новую дату и продолжайте. Откройте цель в приложении и задайте новый срок через «Изменить». 🙂`,
  reminder: (name: string) =>
    `Привет, <b>${escapeHtml(name)}</b>! 👋\n\nНе забудьте внести сегодняшние траты в приложение — или просто напишите их в этот чат! ✍️`,
  firstEntryReminder: (name: string) =>
    `Привет, <b>${escapeHtml(name)}</b>! 👋\n\nЗапишите первый расход — 5 секунд. Отправьте в этот чат:\n\n<code>хлеб 8000</code>\n\nОстальное сделаю я 🔥`,
  registrationDone: (name: string) =>
    [
      `✅ <b>Готово, ${escapeHtml(name)}!</b>`,
      '',
      'Пишите расходы в этот чат — я сам их добавлю:',
      '<code>такси 20000</code>',
      '<code>обед 45 тысяч</code>',
      '',
      '🎤 Голосовые тоже подойдут.',
    ].join('\n'),
  tooManyActions: `В одном сообщении можно записать не больше ${MAX_ACTIONS} операций. Разбейте, пожалуйста, сообщение на несколько. 🙏`,
  amountTooLarge:
    'Сумма выглядит слишком большой (не больше 1 000 000 000 сум или 100 000 долларов за одну операцию). Проверьте сумму и напишите ещё раз.',
  executedHeader: '✅ Готово:',
  executedTx: (desc: string, money: string, income: boolean) => `${desc} (${income ? 'доход' : 'расход'} ${money})`,
  executedGoalCreated: (goal: string, money: string) => `цель «${goal}» (${money})`,
  executedGoalUpdated: (goal: string, money: string) => `цель «${goal}» обновлена (новая сумма: ${money})`,
  executedContribution: (goal: string, money: string) => `в цель «${goal}» добавлено ${money}`,
  confirmTx: (money: string, income: boolean, desc: string) =>
    `Записать ${income ? 'доход' : 'расход'} ${money} («${desc}»)?`,
  confirmGoalCreate: (goal: string, money: string) => `Создать цель «${goal}» на ${money}?`,
  confirmGoalUpdate: (goal: string, money: string) => `Изменить сумму цели «${goal}» на ${money}?`,
  confirmContribution: (goal: string, money: string) => `Добавить ${money} в цель «${goal}»?`,
  confirmMany: (n: number) => `Записать эти операции (${n})?`,
  lineIncome: 'Доход',
  lineExpense: 'Расход',
  savingsGoal: 'Накопления',
  confirmGeneric: 'Пожалуйста, подтвердите данные.',
  writeSomething: 'Пожалуйста, напишите сообщение.',
  received: 'Сообщение получено.',
  cancelledWeb: 'Действие отменено. Никаких финансовых записей не добавлено.',
  rateNote: (rate: string) => `(по курсу 1 $ = ${rate} сум)`,
  aiLanguageRule:
    'Пишите все тексты для пользователя только на русском языке: просто, грамотно, законченными предложениями. Суммы в сумах пишите со словом "сум" (например: 45 000 сум).',
};

const en: BotTexts = {
  fallbackName: 'there',
  openApp: 'Open the app',
  openUzHamyon: 'Open UzHamyon',
  addInApp: '➕ Add in the app',
  openUzHamyonRocket: '🚀 Open UzHamyon',
  openGoal: 'Open goal',
  chooseLanguage: uz.chooseLanguage,
  languageSaved: '✅ Language: English',
  welcomeNew: (name: string) =>
    `<b>Hi, ${escapeHtml(name)}!</b>\n\nUzHamyon is a wallet that logs your spending in 5 seconds.\n\n✍️ Write in this chat: <code>taxi 20000</code>\n🎤 Or send a voice message.\n\nOr open the app with the button below 👇`,
  welcomeReturning: (name: string) =>
    `<b>Welcome back, ${escapeHtml(name)}!</b>\n\nUzHamyon is ready. Keep going with your finances.\n\n🎤 You can also send a voice message — for example: “spent 45 thousand on lunch today”.`,
  appMsg: 'Tap the button below to open the UzHamyon app:',
  help: `<b>UzHamyon — your personal finance assistant.</b>\n\n<b>Commands:</b>\n/start — start UzHamyon\n/app — open the app\n/language — change language\n/help — help\n/about — about UzHamyon\n/delete — delete all my data\n\nYou can also write in plain words:\n• <i>“Spent 45 000 sum on lunch today”</i>\n• <i>“Got my salary, 5 000 000 sum”</i>\n• <i>“Create a 50 mln goal for a car”</i>\n• <i>“How much did I spend this month?”</i>\n\n🎤 Voice messages work too (up to ${MAX_VOICE_SECONDS} seconds) — for example, “lunch 45 thousand, taxi 15 thousand”.`,
  about: `<b>About UzHamyon</b>\n\nUzHamyon is a personal finance and budgeting service for people in Uzbekistan.\n\nTrack income and spending, set savings goals and get tips from artificial intelligence (UzHamyon AI).\n\nAll your data is stored securely and encrypted.`,
  groupNote: `I only work in a private chat — to keep your financial data safe. 🙂\n👉 t.me/${BOT}`,
  aiRetry: '⏳ Sorry, I couldn’t process your message right now. Please try again in a moment.',
  confirm: '✅ Confirm',
  cancel: '❌ Cancel',
  cancelled: '❌ Cancelled. Nothing was recorded.',
  alreadySaved: '✅ This is already saved.',
  wasCancelled: '❌ This was cancelled. Nothing was recorded.',
  executing: '⏳ Saving right now. Check the app in a moment.',
  failedRetry: '⚠️ This couldn’t be saved. Please try again.',
  expired: '⌛ This proposal expired (15 minutes). Please send your message again.',
  saving: '⏳ <i>Saving...</i>',
  accountNotFound: '⚠️ Account not found. Please open the app first.',
  unauthorized: '⛔ Not allowed: this action belongs to another user.',
  actionNotFound: '⚠️ Nothing to confirm was found.',
  cancelNotFound: '⚠️ Nothing to cancel was found.',
  errorOccurred: (msg: string) => `⚠️ Something went wrong: ${escapeHtml(msg)}`,
  couldNotSave: 'Could not save',
  couldNotCancel: 'Could not cancel.',
  streakLine: (n: number) => `🔥 ${n} ${n === 1 ? 'day' : 'days'} in a row!`,
  saved: '✅ Saved.',
  noActiveProposal: '⌛ There is nothing waiting for confirmation (it may have expired). Please send your message again.',
  checking: '⏳ Checking...',
  listening: '🎤 Listening to your voice message...',
  openAccount: (name: string) => `Hi, ${escapeHtml(name)}!\n\nTap the button below to open your UzHamyon account:`,
  updating: '⚠️ The system is being updated. Please try again later.',
  actionSaveFailed: '⚠️ Couldn’t save this. Please try again in a moment.',
  clarifyDefault: 'Please tell me the amount or other details.',
  queryFailed: 'Something went wrong while analysing your finances.',
  chatDefault: (name: string) => `Hi, ${escapeHtml(name)}! How can I help?`,
  youSaid: (transcript: string) => `🎤 <i>You said:</i> “${escapeHtml(transcript)}”\n\n`,
  voice: {
    tooLong: `🎤 That voice message is too long. Please keep it under ${MAX_VOICE_SECONDS} seconds.`,
    tooLarge: '🎤 The file is too large. Please send a shorter voice message.',
    unsupported: '🎤 I can’t read this audio format. Please send a regular voice message or type it.',
    notUnderstood: 'I couldn’t understand the voice message, please type it.',
    videoNote: '🎥 I can’t understand video messages yet. Please send a voice message or text.',
  },
  deletion: {
    prompt: (c: DeletionCounts) =>
      '🗑 <b>Delete all your data?</b>\n\n' +
      'This will be deleted for good:\n' +
      `• ${c.transactions} transactions (income and spending)\n` +
      `• ${c.goals} goals with their savings history\n` +
      `• ${c.budgets} budgets\n` +
      `• ${c.categories} custom categories\n` +
      '• AI chats, reminder settings and your profile\n\n' +
      '⚠️ <b>This can’t be undone.</b> The confirm button works for 5 minutes.',
    confirmBtn: '🗑 Yes, delete everything',
    cancelBtn: '❌ Cancel',
    deleting: '⏳ Deleting your data...',
    done: '✅ All your data has been deleted.\n\nThanks for using UzHamyon. If you want to come back, tap /start — a new, empty account will be created.',
    cancelled: '👌 Cancelled. Your data is untouched.',
    expired: '⌛ The confirmation expired (5 minutes). Send /delete again.',
    invalid: '⛔ This button isn’t for you.',
    failed: '⚠️ Couldn’t delete the data. Please try again in a moment.',
    notFound: 'ℹ️ No saved data was found.',
  },
  goalCompleted: (goal: string) =>
    `🎉 <b>Congratulations!</b> You reached your goal “${escapeHtml(goal)}”!\n\nGreat result — keep it up! 💪`,
  goalDeadline: (goal: string, date: string) =>
    `⏰ The deadline for your goal “${escapeHtml(goal)}” (${escapeHtml(date)}) has passed, but it isn’t reached yet.\n\n` +
    `No problem — set a new date and keep going. Open the goal in the app and pick a new deadline with “Edit”. 🙂`,
  reminder: (name: string) =>
    `Hi, <b>${escapeHtml(name)}</b>! 👋\n\nDon’t forget to log today’s spending in the app — or just write it in this chat! ✍️`,
  firstEntryReminder: (name: string) =>
    `Hi, <b>${escapeHtml(name)}</b>! 👋\n\nLog your first expense — 5 seconds. Send this to the chat:\n\n<code>bread 8000</code>\n\nI’ll do the rest 🔥`,
  registrationDone: (name: string) =>
    [
      `✅ <b>All set, ${escapeHtml(name)}!</b>`,
      '',
      'Write your spending in this chat — I’ll add it for you:',
      '<code>taxi 20000</code>',
      '<code>lunch 45k</code>',
      '',
      '🎤 Voice messages work too.',
    ].join('\n'),
  tooManyActions: `One message can hold at most ${MAX_ACTIONS} entries. Please split it into several messages. 🙏`,
  amountTooLarge:
    'That amount looks too large (at most 1 000 000 000 sum or 100 000 dollars per entry). Please check it and write again.',
  executedHeader: '✅ Done:',
  executedTx: (desc: string, money: string, income: boolean) => `${desc} (${income ? 'income' : 'expense'} ${money})`,
  executedGoalCreated: (goal: string, money: string) => `goal “${goal}” (${money})`,
  executedGoalUpdated: (goal: string, money: string) => `goal “${goal}” updated (new amount: ${money})`,
  executedContribution: (goal: string, money: string) => `${money} added to goal “${goal}”`,
  confirmTx: (money: string, income: boolean, desc: string) => `Record ${income ? 'income' : 'an expense'} of ${money} (“${desc}”)?`,
  confirmGoalCreate: (goal: string, money: string) => `Create the goal “${goal}” for ${money}?`,
  confirmGoalUpdate: (goal: string, money: string) => `Change the goal “${goal}” to ${money}?`,
  confirmContribution: (goal: string, money: string) => `Add ${money} to the goal “${goal}”?`,
  confirmMany: (n: number) => `Record these ${n} entries?`,
  lineIncome: 'Income',
  lineExpense: 'Expense',
  savingsGoal: 'Savings',
  confirmGeneric: 'Please confirm the details.',
  writeSomething: 'Please write a message.',
  received: 'Message received.',
  cancelledWeb: 'Cancelled. Nothing was recorded.',
  rateNote: (rate: string) => `(at the rate 1 $ = ${rate} UZS)`,
  aiLanguageRule:
    'Write every user-facing text in clear, simple English with complete sentences. Write so‘m amounts with "UZS" (for example: 45 000 UZS).',
};

const TEXTS: Record<Lang, BotTexts> = { uz, ru, en };

export function botTexts(lang: Lang | null | undefined): BotTexts {
  return TEXTS[lang ?? 'uz'] ?? uz;
}

/** Inline keyboard for picking the language in the bot. */
export const LANG_CALLBACK_PREFIX = 'lang:';
export function buildLanguageKeyboard() {
  return [
    [
      { text: '🇺🇿 O‘zbekcha', callback_data: `${LANG_CALLBACK_PREFIX}uz` },
      { text: '🇷🇺 Русский', callback_data: `${LANG_CALLBACK_PREFIX}ru` },
      { text: '🇬🇧 English', callback_data: `${LANG_CALLBACK_PREFIX}en` },
    ],
  ];
}

/** "✅ Done:\n• …" for executed actions, in the user's language (plain text, not escaped). */
export function describeExecutedActions(actions: DescribableAction[], lang: Lang): string {
  const t = botTexts(lang);
  const lines = actions.map((a) => {
    const money = formatMoneyIn(
      a.actionType === 'create_goal' || a.actionType === 'update_goal' ? a.targetAmount || a.amount : a.amount,
      a.currency,
      lang
    );
    if (a.actionType === 'create_transaction') return t.executedTx(a.description || '', money, a.transactionType === 'income');
    if (a.actionType === 'create_goal') return t.executedGoalCreated(a.goalName || t.savingsGoal, money);
    if (a.actionType === 'update_goal') return t.executedGoalUpdated(a.goalName || t.savingsGoal, money);
    return t.executedContribution(a.goalName || t.savingsGoal, money);
  });
  return `${t.executedHeader}\n${lines.map((l) => `• ${l}`).join('\n')}`;
}

/** Preview asking to confirm extracted actions (used when the AI gave no summary). */
export function describeProposal(actions: DescribableAction[], lang: Lang): string {
  const t = botTexts(lang);
  if (actions.length === 1) {
    const a = actions[0];
    const money = (v: number) => formatMoneyIn(v, a.currency, lang);
    if (a.actionType === 'create_transaction') return t.confirmTx(money(a.amount), a.transactionType === 'income', a.description || '');
    if (a.actionType === 'create_goal') return t.confirmGoalCreate(a.goalName || '', money(a.targetAmount || a.amount));
    if (a.actionType === 'update_goal') return t.confirmGoalUpdate(a.goalName || '', money(a.targetAmount || a.amount));
    if (a.actionType === 'contribute_goal') return t.confirmContribution(a.goalName || t.savingsGoal, money(a.amount));
    return '';
  }
  if (actions.length > 1) {
    const lines = actions.map(
      (a, i) =>
        `${i + 1}. ${a.description} (${a.transactionType === 'income' ? t.lineIncome : t.lineExpense}): ${formatMoneyIn(a.amount, a.currency, lang)}`
    );
    return `${t.confirmMany(actions.length)}\n\n${lines.join('\n')}`;
  }
  return '';
}
