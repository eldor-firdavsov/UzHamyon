# UzHamyon — Mobil Dashboard Dizayn Qarorlari (Design Decisions)

Ushbu hujjat **UzHamyon** mobil ilovasi uchun ishlab chiqilgan Wise uslubidagi mobil-first dizayn prototipining (`design-prototype` tarmog‘i) asosiy vizual va arxitekturaviy qarorlarini, foydalanilgan tokenlarni hamda texnik xususiyatlarini bayon qiladi.

---

## 1. Loyiha izolyatsiyasi va xavfsizlik (Isolation & Zero Regression)

1. **Alohida Git tarmog‘i:**
   - Barcha prototip kodlari `design-prototype` nomli alohida Git tarmog‘ida joylashgan. Asosiy `main` tarmog‘idagi barcha ishlab chiqarish (production) kodlari o‘zgarishsiz saqlangan.
2. **Nol ishlab chiqarish o‘zgarishi:**
   - Mavjud Supabase ma’lumotlar bazasi, RLS qoidalari, autentifikatsiya tizimi, API marshrutlari va moliyaviy hisob-kitoblar logikasiga **umuman tegilmadi**.
3. **Mustaqil demo ma’lumotlar:**
   - Prototip uchun Toshkent/O‘zbekiston moliyaviy kontekstiga to‘liq mos keladigan, aniq belgilangan demo ma’lumotlar to‘plami (`src/prototype/demoData.ts`) yaratildi.
4. **Izolyatsiyalangan sahifa marshruti:**
   - Prototip `http://localhost:3000/prototype` manzilida ishlaydi va avtorizatsiya talab qilmasdan bevosita ko‘rish va sinash imkonini beradi.

---

## 2. Vizual yo‘nalish va Wise uslubi

Prototip Wise kompaniyasining qulay, funksional, ortiqcha yuklamalarsiz va ishonch uyg‘otuvchi moliyaviy dizayn tamoyillariga asoslangan:

- **Minimalistik va toza interfeys:** Ortiqcha bezaklar, chalg‘ituvchi bannerlar yoki murakkab animatsiyalardan voz kechilib, asosiy e’tibor foydalanuvchi mablag‘lari va pul oqimiga qaratildi.
- **Taniqli brend ranglari (Wise Lime & Forest Green):**
  - Asosiy diqqat markazida jami daromad kartasi Wise uslubidagi baquvvat och yashil rang (`#9FE870`) va to‘q yashil (`#163300`) matn bilan ajratilgan.
  - Orqa fon qulay, ko‘zni toliqtirmaydigan neytral off-white (`#F7F8F5`).
  - Kartalar toza oq (`#FFFFFF`) bo‘lib, mayin chegara (`#E8EBE5`) va nozik soya (`rgba(23,27,22,0.04)`) bilan ajratilgan.
- **Tipografiya va raqamlar iyerarxiyasi:**
  - Katta summalar uchun monospaced/tabular-nums raqamlar ishlatildi, bu mablag‘larni qulay o‘qish va taqqoslashni ta’minlaydi.
  - Valyuta formati O‘zbekiston so‘mi uchun standart formatga keltirildi: `12 000 000 so‘m`.
- **Yumaloqlik (Corner Radius):**
  - Kartalar: `20px` va `22px`
  - Tugmalar va pill elementlar: to‘liq yumaloq (`rounded-full` / `9999px`)
  - Kirish maydonlari: `14px`–`16px`

---

## 3. Dizayn Tokenlari Palitrasi

| Token Nomi | Qiymati | Qo‘llanilishi |
| :--- | :--- | :--- |
| `primary` | `#9FE870` | Wise Lime — Asosiy aksent, hero karta va yangi amal qo‘shish (+) tugmasi |
| `primaryDark` | `#163300` | To‘q yashil — Lime ustidagi matnlar, faol navigatsiya piktogrammalari |
| `primarySubtle` | `#F0F9E9` | Mayin yashil fon — Kichik piktogramma doiralari va AI nishonchalari |
| `background` | `#F7F8F5` | Ilovaning asosiy neytral foni |
| `surface` | `#FFFFFF` | Barcha asosiy bloklar va kartalar foni |
| `textPrimary` | `#171B16` | Bosh sarlavhalar va asosiy matnlar |
| `textSecondary` | `#697168` | Yordamchi tavsiflar, sanalar va toifalar |
| `border` | `#E8EBE5` | Kartalar va ajratuvchi chiziqlar chegarasi |
| `income` | `#26834A` | Ijobiy tushumlar, kirim ko‘rsatkichlari |
| `expense` | `#D64D4D` | Chiqimlar va sarf-xarajatlar |

---

## 4. Mobil Bosh Sahifa (Dashboard) Bloklari

Bosh sahifa talabga muvofiq **QAT’IY 6 TA** asosiy blokdan tashkil topgan:

### Blok 1: Moliyaviy ko‘rsatkichlar (Financial Overview)
- **Asosiy Hero Karta (`#9FE870`):** Jami qayd etilgan daromad — **12 000 000 so‘m** (Barcha vaqt).
- **Davr daromadi:** +6 000 000 so‘m (Oktabr 2026).
- **Davr xarajati:** -4 950 000 so‘m (Oktabr 2026).
- *Qaror sababi:* Foydalanuvchi birinchi nigohdayoq o‘zining umumiy moliyaviy quvvatini va joriy oydagi dinamikasini ko‘radi.

### Blok 2: Pul oqimi grafigi (Financial Chart)
- Kirim va chiqimlarning vaqt bo‘yicha ustunli grafigi.
- Davr almashuvi: **"Joriy oy" (1-7, 8-14, 15-21, 22-28, 29-31 okt)**, **"3 oy" (Avg, Sen, Okt)**, **"Jami"**.
- Ustunlar ustiga bosganda yoki surilganda aniq summa ko‘rsatiladi.
- *Qaror sababi:* Vizual taqqoslash orqali haftalik va oylik xarajatlar yuklamasini aniqlash.

### Blok 3: Kirim va chiqimlar oqimi (Monthly Cash Flow)
- 3 ta alohida qatorda:
  1. Oylik daromad: `+6 000 000 so‘m`
  2. Oylik xarajat: `-4 950 000 so‘m`
  3. Sof farq (qoldiq): `+1 050 000 so‘m`
- "Shu oy" va "Jami" rejimlari o‘rtasida almashtirish imkoniyati.
- *Qaror sababi:* Foydalanuvchiga oy oxirida qancha mablag‘ erkin qolganini tushunarli ko‘rsatish.

### Blok 4: So‘nggi amallar (Recent Transactions)
- So‘nggi 5 ta tranzaksiya (Oylik maosh, Korzinka Supermarket, Yandex Go, Rayhon Milliy Taomlar, Uztelecom Internet).
- Har bir qatorda: toifa piktogrammasi, nomi, toifasi, sanasi va aniq rang bilan ajratilgan tabular summa.
- *Qaror sababi:* Kundalik operatsiyalarni tezkor nazorat qilish.

### Blok 5: AI tavsiyasi (AI Recommendation)
- Qisqa, aniq va ma’lumotlarga tayangan 1 ta tavsiya:
  > *"Joriy davrda daromadingizning 17.5% qismi (+1 050 000 so‘m) ijobiy qoldiq sifatida tejaldi. Bu mablag‘ni 'MacBook Pro' maqsadiga yo‘naltirish tavsiya etiladi."*
- "AI bilan maslahatlashish" harakat tugmasi.
- AI yordamchisi uchun alohida brend nomi qo‘shilmagan, faqat "AI" sifatida ifodalangan.

### Blok 6: Jamg‘arma maqsadlari xulosasi (Savings Goals Summary)
- Faol 3 ta maqsad:
  1. **MacBook Pro M4:** 4 800 000 / 15 000 000 so‘m (32%)
  2. **Dam olish safari (Dubay):** 7 200 000 / 12 000 000 so‘m (60%)
  3. **Favqulodda jamg‘arma fondi:** 5 600 000 / 8 000 000 so‘m (70%)
- Vizual progress chizig‘i va bosganda mablag‘ qo‘shish imkonini beruvchi modal darcha.

---

## 5. Mobil Navigatsiya va Amallar Arxitekturasi

- **Suzuvchi pastki navigatsiya (Floating Bottom Nav):**
  - **4 ta yumaloq piktogrammali tugma** (matnsiz, minimalistik):
    1. `Home` (Bosh sahifa)
    2. `Receipt` (Faoliyat)
    3. `BarChart2` (Tahlil)
    4. `Brain` (AI)
  - Faol bo‘lim to‘q yashil doira (`#163300`) ichida Wise Lime (`#9FE870`) piktogrammasi bilan ajralib turadi.
- **Alohida Yangi Amal Tugmasi (Plus Button):**
  - Navigatsiya panelining o‘ng tomonida alohida ajratilgan yumaloq yashil (`#9FE870`) `+` tugmasi.
  - Bosilganda zamonaviy pastdan chiquvchi modal darchani ochadi:
    - Kirim / Chiqim o‘tkazgichi
    - Katta formatlangan summa kiritish maydoni
    - Toifalar chiplari (Oziq-ovqat, Kafe, Transport, Uy-ro‘zg‘or, Aloqa, Kiyim va h.k.)
    - Saqlash bilan birga demo holat yangilanadi va toast xabarnoma ko‘rsatiladi.

---

## 6. Moslashuvchanlik (Responsiveness)

Prototip quyidagi asosiy mobil o‘lchamlarda to‘liq sinovdan o‘tkazildi:
1. **390px (Boshlang‘ich standart — iPhone 12/13/14/15/16)**: Barcha kartalar, shriftlar va chetki masofalar ushbu o‘lcham uchun optimal moslashtirilgan.
2. **320px (Kichik ekranlar — iPhone SE)**: Matnlar va kartalar siqilmasdan to‘g‘ri sinadi.
3. **375px (Klassik mobil — iPhone X/XS/11 Pro)**: Ideal mutanosiblik.
4. **430px (Katta mobil — iPhone Plus / Pro Max)**: Kengaytirilgan qulay maydon.

---

## 7. Mavjud Cheklovlar (Known Limitations)

1. **Faqat Demo Ma’lumotlar:** Prototip ma’lumotlar bazasiga ulanmagan. Tranzaksiya qo‘shish yoki jamg‘arma to‘ldirish faqat joriy brauzer sessiyasida demo sifatida ishlaydi (sahifa yangilanganda dastlabki holatiga qaytadi).
2. **Ikkinchi darajali sahifalar (Faoliyat, Tahlil, AI):** Faqat tushuntiruvchi placeholder holatida. Ular Bosh sahifa yo‘nalishi ko‘rib chiqilib, ma’qullangandan so‘ng navbatma-navbat ishlab chiqiladi.
3. **Offline sinov muhiti:** Brauzer subagentining avtomatlashtirilgan Playwright drayveri konteyner ichidagi tarmoq cheklovi tufayli tashqi paket yuklay olmadi; lekin mahalliy `google-chrome --headless` orqali to‘liq pikselli skrinshotlar muvaffaqiyatli olindi.

---

## 8. Skrinshotlar va Vizual Namunalar

- 390px Bosh sahifa skrinshoti: `docs/prototype-preview/dashboard_390px_complete.png`
- 430px Bosh sahifa skrinshoti: `docs/prototype-preview/dashboard_430px_complete.png`
- Dastlabki ekran skrinshoti: `docs/prototype-preview/dashboard_390px.png`
