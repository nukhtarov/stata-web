# Stata-тренажёр

Браузерный тренажёр Stata для курса эконометрики: импорт Excel, описательная статистика, МНК и проверка предпосылок П1–П5 с пояснениями простыми словами. Всё считается в браузере, бэкенда нет.

Прод: https://stata.nukhtarov.ru (Raspberry Pi, `npm run deploy`) и GitHub Pages (автоматически из `main`).

## Данные

- `public/demo/housing_demo.xlsx` — синтетический учебный датасет (кнопка «Пример данных»), генерируется `tests/reference/make_demo.py`. Все значения выдуманы.
- Курсовой датасет и сверка с выводом настоящей Stata 14.2 лежат в `tests/fixtures/private/` (не в git). Если папка на месте, `npm test` дополнительно сверяет вывод посимвольно; в CI эти тесты пропускаются.

## Команды

```bash
npm install
npm run dev          # разработка
npm test             # юнит + интеграционные тесты (сверка с эталоном Stata 14.2)
npm run test:e2e     # Playwright (BASE_URL=https://… — прогон против прода)
npm run reference    # пересчитать эталон в Python (нужен .venv-ref, см. tests/reference/compute.py)
npm run deploy       # сборка и выкладка на Raspberry Pi (адрес — DEPLOY_HOST в .deploy.env)
```

## Структура

- `src/stats` — математика (QR, распределения, OLS, тесты, kdensity/lowess, формат чисел Stata)
- `src/lang` — разбор команд, выражения, команды (`commands/*.ts`), сессия, автодополнение
- `src/data` — датасет и импорт Excel
- `src/explain` — пояснения, статусы П1–П5, общий вывод
- `src/ui` — Svelte 5: консоль, CodeMirror, графики SVG
- `tests/fixtures` — эталонный xlsx и JSON из Python
