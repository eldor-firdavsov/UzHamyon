# UzHamyon — Kuchaytirilgan Vizual Identika va Moliyaviy Iyerarxiya

Ushbu hujjat **UzHamyon** prototipining (`design-prototype` tarmog‘i) yangilangan vizual tili, qat’iy uch bosqichli karta arxitekturasi va pul miqdorini bosh qahramonga aylantirgan boyitilgan fintech dizayn tizimini bayon qiladi.

---

## 1. Asosiy Muammoning Yechimi: Mablag‘lar Bosh Qahramonga Aylantirildi

Oldingi o‘ta minimalist versiyada barcha ma’lumotlar bir xil oq kartochkalarda ko‘rinib, vizual xarakter yo‘qolgan edi. Yangi tizimda mablag‘lar birinchi nigohdayoq ko‘zga tashlanadi:

- **Bosh Summa (Hero Amount):**
  - O‘lcham: Mobil ekranda **44px**, Desktop ekranda **52px** (`font-mono`, `font-extrabold`).
  - To‘q o‘rmon yashil (`#163300`) boy fonga ega **Type A Hero Karta** ichida joylashtirildi.
  - Valyuta belgisi (`so‘m`) ikkinchi darajali qilib alohida neon-yashil rangda ajratildi.
  - Orqa fonda suv belgili yoylar va mayin nur effektlari mavjud.

---

## 2. Uch Bosqichli Karta Dizayn Tizimi (3 Card Treatments)

Endi har bir bo‘lim bir xil kulrang ramkali oq quti emas:

### 1. Type A: Qahramon Karta (Hero Card — Asosiy Daromad)
- **Foni:** Boy to‘q yashil gradient (`from-[#163300] via-[#1b3d02] to-[#122800]`).
- **Xarakteri:** Mutlaq yuqori kontrast, oq shrift, Wise neon-yashil (`#9FE870`) nishonlar va nurlar.
- **Vazifasi:** Ilovaning moliyaviy markazi, eng kuchli vizual langar.

### 2. Type B: Metrik Kartalar (Metric Cards — Daromad va Xarajat)
- **Foni:** Rang bilan nozik bo‘yalgan sirtlar (subtle tinted backgrounds):
  - **Davr daromadi:** Yumshoq yalpiz/zumrad tus (`bg-[#EDF8F1]`, chegara `border-[#C5E9D2]`, matn `#1E7440`).
  - **Davr xarajati:** Yumshoq marjon/qizil tus (`bg-[#FDF2F2]`, chegara `border-[#F8C8C8]`, matn `#C53B3B`).
- **Xarakteri:** Katta `24px`–`26px` tabular raqamlar, doiraviy rangli semantik piktogrammalar.
- **Joylashuvi:** Mobilda yonma-yon 2 ustunda, desktopda esa yuqori boshqaruv panelida Hero Card yonida uyg‘un integratsiya qilingan.

### 3. Type C: Mazmun Sirtlari (Content Surfaces — Grafik, Amallar, AI, Jamg‘armalar)
- **Foni:** Yengil ko‘tarilgan (elevated) oq sirtlar (`bg-white`), mayin soyalar (`shadow-[0_4px_20px_rgba(23,27,22,0.04)]`) va aniq chegara.
- **Bo‘limlar:**
  - **Pul oqimi grafigi:** Kengaygan maydon, gorizontal to‘r chiziqlari, qulay ustunlar va ixcham davr tanlagichi.
  - **Kirim va chiqimlar oqimi:** Oylik daromad, xarajat va alohida ajratilgan yashil fondagi **Sof farq (qoldiq)** bloki.
  - **So‘nggi amallar:** O‘ziga xos toifa piktogrammalari, toza tipografiya va aniq tabular summalar.
  - **AI tavsiyasi:** O‘ziga xos brendlashtirilgan ko‘rinish — chap chetida zumrad rangli tasma, mayin yashil gradient va qora/lime rangli harakat tugmasi.
  - **Jamg‘arma maqsadlari:** Ko‘zga yaqqol tashlanadigan qalin (10px) gradientli progress chizig‘i, aniq foiz nishoni va yig‘ilgan/maqsad summalar.

---

## 3. Oldingi va Yangi Dizayn Taqqoslovi (Before vs. After)

| O‘lchov | Oldingi (Minimalist) | Yangi (Kuchaytirilgan Identika) |
| :--- | :--- | :--- |
| **Bosh Summa Kontrasti** | Oq fonga qora oddiy matn (boshqa kartalardan deyarli ajralmas edi) | **To‘q yashil (#163300) Hero kartada 52px oq va neon-yashil raqamlar** |
| **Kirim/Chiqim Kartalari** | Oddiy oq kartochkalar | **Yumshoq zumrad (#EDF8F1) va qizil (#FDF2F2) nozik rangli sirtlar** |
| **Kartalar Farqi** | Barcha 6 ta blok bir xil oq to‘rtburchak edi | **3 xil darajadagi (Type A, B, C) qat’iy vizual tabaqalanish** |
| **Grafik Ko‘rinishi** | Yupqa va kichik ustunlar | **Keng formatli, gorizontal yo‘naltiruvchi chiziqli va qalin ustunlar** |
| **Jamg‘arma Progressi** | Yupqa 6px chiziq | **Qalin (10px) gradientli, yaqqol ko‘rinuvchi progress chizig‘i** |
| **AI Bloki** | Oddiy oq karta | **Chap tasmali, mayin yashil gradientli brend bloki** |

---

## 4. Skrinshotlar Arxiv va Havolalari

- **Yangi Desktop (1440px):** [new_desktop_1440px.png](file:///home/eldor_firdavsov/Desktop/SpendSense/docs/prototype-preview/new_desktop_1440px.png)
- **Yangi Desktop (To‘liq sahifa):** [new_desktop_1440px_full.png](file:///home/eldor_firdavsov/Desktop/SpendSense/docs/prototype-preview/new_desktop_1440px_full.png)
- **Oldingi Desktop (Taqqoslov uchun):** [before_desktop_1440px.png](file:///home/eldor_firdavsov/Desktop/SpendSense/docs/prototype-preview/before_desktop_1440px.png)
- **Yangi Mobil (390px):** [new_mobile_390px.png](file:///home/eldor_firdavsov/Desktop/SpendSense/docs/prototype-preview/new_mobile_390px.png)
- **Yangi Mobil (To‘liq sahifa):** [new_mobile_390px_full.png](file:///home/eldor_firdavsov/Desktop/SpendSense/docs/prototype-preview/new_mobile_390px_full.png)
- **Oldingi Mobil (Taqqoslov uchun):** [before_mobile_390px.png](file:///home/eldor_firdavsov/Desktop/SpendSense/docs/prototype-preview/before_mobile_390px.png)
- **Boshqa o‘lchamlar:** `mobile_320px.png`, `mobile_375px.png`, `mobile_430px.png`, `desktop_1024px.png`, `desktop_1280px.png`, `desktop_1920px.png`.
