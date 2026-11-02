# UzHamyon — Mobil va Desktop Dizayn Prototipi (Design Decisions)

Ushbu hujjat **UzHamyon** ilovasi uchun Wise uslubidagi mobil-first va to‘liq moslashuvchan (responsive) desktop dizayn prototipining (`design-prototype` tarmog‘i) yangilangan vizual qarorlari, soddalashtirilgan kartalar tizimi, tipografik iyerarxiyasi hamda desktop adaptatsiyasini bayon qiladi.

---

## 1. Loyiha Izolyatsiyasi va Nol Regressiya (Isolation & Zero Regression)

1. **Alohida Git Tarmog‘i:**
   - Barcha prototip kodlari faqat `design-prototype` Git tarmog‘ida joylashgan. Asosiy `main` tarmog‘i o‘zgarishsiz qoldirilgan.
2. **Nol Ishlab Chiqarish O‘zgarishi:**
   - Mavjud Supabase ma’lumotlar bazasi, jadvallar, RLS qoidalari, autentifikatsiya tizimi, API marshrutlari va moliyaviy hisob-kitoblar logikasiga **umuman tegilmadi**.
3. **Avtonom Demo Ma’lumotlar:**
   - Toshkent/O‘zbekiston moliyaviy kontekstiga to‘liq mos keladigan mustaqil demo ma’lumotlar (`src/prototype/demoData.ts`).
4. **Izolyatsiyalangan Marshrut:**
   - Prototip `http://localhost:3000/prototype` manzilida ishlaydi va avtorizatsiya talab qilmasdan bevosita ko‘rish va sinash imkonini beradi.

---

## 2. Vizual Qayta Ishlash va Ortiqcha Kartalarni Qisqartirish (Visual Refinement)

Foydalanuvchi mulohazalariga muvofiq, interfeysdagi ortiqcha ramkalar, chegaralar va ko‘p qatlamli (nested) kartalar to‘liq tozalanib, **bo‘shliq (whitespace)** va **to‘g‘ri tipografiya** orqali sokin, yengil hamda diqqatni faqat moliyaviy ma’lumotlarga qaratuvchi muhit yaratildi:

- **Sokin Neytral Folar:**
  - Jami daromad kartasidagi qizg‘ish/baquvvat neon yashil fon o‘rniga, oq fon (`#FFFFFF`), nozik soch tolasi chegarasi (`#E8EBE5`/60) va mayin yashil aksentli nishoncha tanlandi.
  - Barcha bo‘limlar alohida rang-barang fonlar bilan raqobatlashmaydi; neytral `#F7F8F5` foni va oq asosiy yuzalar orqali tabiiy guruhlanadi.
- **Ichma-ich kartalardan (Nested Cards) to‘liq voz kechish:**
  - `FinancialOverviewBlock`: Jami daromad va davr daromadi/xarajati endi alohida 3 ta kartada emas, balki bitta yaxlit, xotirjam va toza panel ichida nozik ajratgich bilan birlashtirildi.
  - `MonthlyCashFlowBlock`: Har bir qator alohida kulrang quti emas, balki qulay, havodor ro‘yxat qatorlari ko‘rinishiga keltirildi.
  - `RecentTransactionsBlock`: Har bir tranzaksiya qutisi o‘rniga mayin ajratuvchi chiziqlarga ega minimalist ro‘yxat tuzilmasi.
  - `AIRecommendationBlock`: Ichki qora/kulrang qutichadan voz kechilib, chap tomonda nozik zumrad chiziq (`border-l-4 border-l-[#26834A]`) bilan ajratilgan toza sirt.
  - `SavingsGoalsBlock`: Ichki alohida kartochkalar o‘rniga ixcham, ingichka (6px) progress chizig‘iga ega toza qatorlar.
- **Yashil rangning o‘rni:** Yashil faqat ma’noli aksentlar (ijobiy tushumlar, birlamchi harakat tugmasi, progress ko‘rsatkichi) uchun saqlandi.

---

## 3. Desktop Adaptatsiyasi (1440px Birlamchi Standart)

Ilova faqat mobil emas, balki to‘laqonli zamonaviy desktop fintech mahsuloti darajasiga ko‘tarildi:

### Desktop Navigatsiya (`DesktopHeader.tsx`)
- Ekranning yuqori qismida yopishib turuvchi (sticky) qulay navigatsiya paneli (faqat `lg:` va undan katta ekranlarda ko‘rinadi):
  - **Chapda:** `UzHamyon` logotipi (yashil hamyon ramzi) va `Demo rejim` nishoni.
  - **Markazda:** Asosiy 4 ta bo‘lim: **Bosh sahifa**, **Faoliyat**, **Tahlil**, **AI**. Faol holat to‘q yashil (`#163300`) fon va oq matn bilan yaqqol ajratilgan.
  - **O‘ngda:** Wise Lime (`#9FE870`) rangidagi **"+ Yangi amal"** bosh tugmasi, xabarnoma qo‘ng‘irog‘i va foydalanuvchi profili (`AQ` / Aziz Qodirov).
- **Mobil navigatsiya:** Suzuvchi pastki bar (`FloatingMobileNav`) desktopda butunlay yashiriladi (`lg:hidden`).

### Desktop Kompozitsiyasi (Grid Layout)
- **Maksimal Kenglik Cheklovi (`max-w-7xl` — 1280px):** 1920px yoki 1600px ekranlarda ham kontent cheksiz cho‘zilib ketmaydi, ekranning markazida xotirjam joylashadi.
- **Sarlavha Qatori:** "Moliyaviy holat" sarlavhasi, sana filtri ("📅 Oktabr 2026") va kontekstual amal tugmasi.
- **Yuqori Blok:** Jami qayd etilgan daromad va davr daromadi/xarajatlari birlashgan keng formatli sirt.
- **Ikki Ustunli Balanslangan Grid (`12 ustunli`):**
  - **Asosiy Chap Ustun (7-8 ustun):**
    1. *Pul oqimi grafigi:* Kengroq maydon, nozik chiziqli gorizontal to‘r, ustunlar ustiga borganda/bosilganda aniq ko‘rsatkich.
    2. *Kirim va chiqimlar oqimi:* Daromad, xarajat va sof qoldiqning ixcham tahlili.
  - **Qo‘llab-quvvatlovchi O‘ng Ustun (4-5 ustun):**
    1. *So‘nggi amallar:* 5 ta tranzaksiyadan iborat ixcham toza ro‘yxat.
    2. *AI tavsiyasi:* Chalg‘itmaydigan, to‘g‘ridan-to‘g‘ri matn va harakat tugmasiga ega qulay blok.
    3. *Jamg‘arma maqsadlari:* Ixcham progress ko‘rsatkichlari va bosganda mablag‘ kiritish oynasi.

---

## 4. Tipografik Iyerarxiya

- **Shrift:** Inter.
- **Asosiy Raqamlar:** `font-mono`, `tabular-nums`, `font-bold` (32px–40px). Raqamlar bir-birini siljitmaydi, o‘qish oson.
- **Bo‘lim Sarlavhalari:** `font-semibold` (14px–16px), `tracking-tight`.
- **Yorliqlar va Matnlar:** `font-medium` (12px–13px), `text-[#697168]`.
- **Ikkinchi Darajali Izohlar:** `text-[10px]–[11px]`, `text-[#959E94]`.

---

## 5. Sinovdan O‘tkazilgan Viewportlar va Skrinshotlar

Quyidagi barcha talab qilingan o‘lchamlarda to‘liq skrinshotlar olindi va gorizontal siljish (overflow) yo‘qligi tekshirildi:

| Viewport | Turi | Fayl | Xulosasi |
|---|---|---|---|
| **320px** | Kichik mobil | `docs/prototype-preview/mobile_320px.png` | Matnlar qisqarishsiz toza sig‘adi, 0 horizontal scroll |
| **375px** | Klassik mobil | `docs/prototype-preview/mobile_375px.png` | Mutanosib bo‘shliqlar va ixcham kartalar |
| **390px** | Asosiy mobil | `docs/prototype-preview/mobile_390px.png` / `mobile_390px_full.png` | Asosiy mobil standart, toza va xotirjam ko‘rinish |
| **430px** | Katta mobil | `docs/prototype-preview/mobile_430px.png` | Kengaytirilgan qulay ekran |
| **1024px** | Planshet / Kichik desktop | `docs/prototype-preview/desktop_1024px.png` | Desktop header va ko‘p ustunli tartibga muammosiz o‘tish |
| **1280px** | Standart desktop | `docs/prototype-preview/desktop_1280px.png` | Ideal ikki ustunli nisbat |
| **1440px** | Asosiy desktop | `docs/prototype-preview/desktop_1440px.png` / `desktop_1440px_full.png` | Mukammal fintech kompozitsiyasi va bo‘shliqlar |
| **1600px** | Katta desktop | `docs/prototype-preview/desktop_1600px.png` | Markazlashgan tartib |
| **1920px** | Full HD monitor | `docs/prototype-preview/desktop_1920px.png` | 1280px chegarasida chiroyli chekka masofalar |

---

## 6. Mavjud Interaktivlik

- **Yangi amal qo‘shish (+):** Mobil floating bar yoki Desktop headerdagi "+ Yangi amal" tugmasi orqali slide-up sheet ochiladi, kiritilgan summa va toifa ro‘yxatga qo‘shiladi hamda barcha ko‘rsatkichlar qayta hisoblanadi.
- **Jamg‘arma to‘ldirish:** Har bir maqsad ustiga bosganda modal darcha ochiladi va "+200 000 so‘m kiritish" orqali progress bar to‘ldiriladi.
- **Grafik davrlari:** "Joriy oy", "3 oy", "Jami" tugmalari orqali ustunlar animatsiyalanadi.
- **Bo‘limlar almashinuvi:** Bosh sahifa, Faoliyat, Tahlil, AI o‘rtasida tezkor o‘tish.
