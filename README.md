# 3-мовний сайт "Маніфест Вільної України" (Vue + Firebase)

Готовий шаблон для публікації на GitHub Pages (`vadim4web.github.io`) з відкритим голосуванням:
- 🇺🇦 Українська
- 🇷🇺 Русский
- 🇬🇧 English

## Рекомендована назва нового dedicated repo

Найкращий варіант для "на вдачу" + зрозумілості для колаборації:

**`free-ukraine-luck-manifesto`**

Альтернативи:
1. `manifest-free-ukraine`
2. `liberty-ukraine-manifesto`
3. `ukraine-freedom-vote`

---

## Що вже реалізовано

- Vue 3 сайт з перемикачем 3 мов.
- Контент маніфесту у таблиці + блок "Як це працює разом".
- Опитування в кінці: "За що б ви проголосували як найважливіше?"
- Firebase Firestore інтеграція:
  - зберігає голос;
  - один голос з одного браузера (через localStorage `voterId`);
  - публічно показує live-рейтинг.
- Автодеплой на GitHub Pages через GitHub Actions (`.github/workflows/deploy-pages.yml`).

> Важливо: зміст маніфесту не змінювався по суті, лише перекладено на RU/EN.

---

## 1) Локальний запуск

```bash
cd manifesto-site
npm install
cp .env.example .env
npm run dev
```

Потім відкрий `http://localhost:5173`.

---

## 2) Покрокова інтеграція Firebase

### Крок 1. Створи Firebase проєкт
1. Відкрий Firebase Console.
2. Створи новий проєкт (наприклад `free-ukraine-manifesto`).
3. Додай Web App.

### Крок 2. Увімкни Firestore Database
1. У Firebase: **Build → Firestore Database**.
2. Натисни **Create database**.
3. Режим: Production (або Test для швидкого старту).

### Крок 3. Пропиши env-ключі
У файлі `.env` заповни:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
BASE_PATH=/
```

### Крок 4. Застосуй Firestore Rules
1. Firebase Console → Firestore → Rules.
2. Встав правила з `firestore.rules`.
3. Publish.

### Крок 5. Перевір голосування
- Обери пункт I–V, натисни "Проголосувати".
- Рейтинг оновиться одразу.

---

## 3) Створити окремий repo і запушити весь код

> Нижче — інструкція саме для **нового dedicated репозиторію**.

### 3.1 Створи порожній репозиторій на GitHub
- Назва: `free-ukraine-luck-manifesto`
- Visibility: Public
- Не додавай README/.gitignore/LICENSE на GitHub (щоб не було merge-конфлікту)

### 3.2 Скопіюй код із цієї папки у новий локальний repo

```bash
mkdir free-ukraine-luck-manifesto
cp -R manifesto-site/. free-ukraine-luck-manifesto/
cd free-ukraine-luck-manifesto
git init
git checkout -b main
git add .
git commit -m "Initial commit: tri-lingual manifesto site"
git remote add origin git@github.com:vadim4web/free-ukraine-luck-manifesto.git
git push -u origin main
```

---

## 4) Деплой на GitHub Pages

### Варіант A (рекомендовано): GitHub Actions автодеплой

1. У репозиторії GitHub відкрий **Settings → Pages**.
2. Build and deployment: **Source = GitHub Actions**.
3. Додай Repository Secrets (Settings → Secrets and variables → Actions):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
4. Пуш у `main` автоматично запустить workflow.

### Варіант B: ручний деплой через gh-pages

```bash
npm install
BASE_PATH=/free-ukraine-luck-manifesto/ npm run build
npm run deploy
```

Скрипт `deploy` публікує `dist` у гілку `gh-pages`.

---

## 5) Структура

- `src/App.vue` — головна сторінка, таблиця, голосування, рейтинг.
- `src/content.js` — весь текст 3 мовами.
- `src/firebase.js` — читання/запис голосів у Firestore.
- `firestore.rules` — публічне читання + безпечний create-only сценарій.
- `.env.example` — приклад конфігу.
- `.github/workflows/deploy-pages.yml` — автодеплой на GitHub Pages.

---

## 6) Що можна поліпшити далі (для колаборації)

- Додати Firebase Auth (анонімний логін), щоб сильніше обмежити мультиголоси.
- Додати Cloud Function для anti-spam (rate-limit/IP hash).
- Додати сторінку `/about` про правила маніфесту.
- Додати адмін-дашборд із графіками.
