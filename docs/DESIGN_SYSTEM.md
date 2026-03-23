# Track Legend: Design System & UX Principles

## Section 1 — Design principles
1. **Data first, but guided**: Интерфейс не просто показывает телеметрию, он ведет пользователя к важным бизнес-инсайтам. Сложные данные (например, графики телеметрии) всегда сопровождаются текстовыми выводами и акцентами.
2. **Reference-centric**: Сравнение строится вокруг концепции «твой круг против эталона». Эталонный круг (Reference Lap) закреплен визуально и выступает базовой линией на всех графиках и дельтах.
3. **Actionability over raw complexity**: Пользователь должен понимать, *что* нужно исправить, а не просто получать сырые данные. Это фокус на потерянном времени и причинах: «поздний тормоз в Т3» вместо простого графика скорости.
4. **Zoomable analytical workspace**: Страница сравнения кругов — это рабочая среда. Пользователь должен иметь возможность мгновенно фокусироваться на конкретных поворотах (зум) и возвращаться к общему виду.
5. **Fast scan hierarchy**: За 5 секунд пользователь должен понять главную проблему сессии: худшие сектора, общую потерю времени и ключевые ошибки.

## Section 2 — Product UX strategy
Track Legend — это не игровой HUD и не устаревшая инженерная утилита вроде MoTeC.
**Основные сценарии:**
- После сессии в Le Mans Ultimate пользователь загружает `.duckdb` файл.
- Система парсит данные и выдает список сессий.
- Пользователь открывает сессию, выбирает лучший круг как Reference, берет свой круг и сравнивает их.
- Приложение подсвечивает проблемные повороты в виде карточек-инсайтов.
- **Главный результат:** гонщик понимает свои ошибки (например, Trail braking loss) за пару минут без ручного анализа каждого пикселя графика.

## Section 3 — Design system foundation

### 8.1 Color system
Так как это аналитический инструмент для автоспорта, лучший выбор — **Dark-mode first**. Графики на темном фоне меньше утомляют глаза при длительном анализе и выглядят премиально.

- **Background layers**:
  - Main Background: `#0B0D14` (глубокий сине-черный).
  - Surface/Panel: `#141722` (для карточек и панелей).
  - Hover Surface: `#1B1E2B`.
- **Border colors**:
  - Divider: `#262A3B` (мягко отделяет блоки).
- **Accents**:
  - Primary Accent (Интерактив/Бренд): `#3B82F6` (Electric Blue) — технологично, не конфликтует с красным/зеленым цветами телеметрии.
- **Semantic colors**:
  - Success/Faster (Delta -): `#10B981` (Изумрудный).
  - Error/Slower (Delta +): `#EF4444` (Красный).
  - Warning (Инсайты/Внимание): `#F59E0B` (Теплый желтый).
- **Chart colors (ОЧЕНЬ ВАЖНО)**:
  - Reference Lap (Lap A): `#E2E8F0` (Светло-серый, базовая линия).
  - Current Lap (Lap B): `#3B82F6` (Синий, акцентный) или `#8B5CF6` (Фиолетовый).
  - Throttle: `#10B981` (Зеленый).
  - Brake: `#EF4444` (Красный).
  - Steering: `#8B5CF6` (Фиолетовый).
  - Speed: `#06B6D4` (Циан - хорошо читается как главный показатель поверх других линий).

### 8.2 Typography
- **Font Pair**: `Inter` для чистого UI (отличная читаемость в мелком кегле) и `JetBrains Mono` для значений телеметрии.
- **Scale**:
  - Display: 36px, Bold (заголовки страниц).
  - Heading: 20px, SemiBold (названия панелей, секций).
  - Body: 14px, Regular (основной текст, таблицы).
  - Caption: 12px, Medium (подсказки, легенда).
  - Mono (Telemetry Values): 13px, `JetBrains Mono` (Lap times, Delta ms, Speed).

### 8.3 Spacing
Основа — классический 8pt grid.
`4px (2xs), 8px (xs), 12px (sm), 16px (md), 24px (lg), 32px (xl), 48px (2xl), 64px (3xl).`

### 8.4 Radius / borders / shadows
- **Radius**: 6px для Inputs/Buttons (строгий, технический, но не слишком острый вид), 12px для Cards/Panels.
- **Borders**: Тонкий бордюр `1px solid #262A3B` вокруг всех карточек.
- **Shadows**: В темной теме тени работают плохо, поэтому мы используем многослойность (разные градации фона) и тонкие бордюры для выделения панелей (Elevation by Lightness & Borders).

### 8.5 Grid / layout system
- Desktop-first (мин. ширина 1024px, оптимально 1440px+).
- CSS Grid: 12 колонок. Боковая панель навигации `240px` (или свернутая `64px`), остальное пространство - контент.
- Графики занимают 100% ширины контейнера для максимального использования widescreen.

## Section 4 — Component system
1. **Navigation**: 
   - Compact Left Sidebar (переключатель сессий, upload).
   - Top Context Header (хлебные крошки: Сессия -> Lap Compare).
2. **Inputs**:
   - Primary Button (Solid Blue), Secondary Button (Ghost/Outline).
   - Dropzone: пунктирный бордюр, иконка файла `.duckdb`, highlight on file hover.
3. **Data display**:
   - Stat Card: Значение (Mono font), дельта (зеленый/красный), лейбл.
   - Lap Badge: плашка `Lap 15`, может применяться статус `Best Lap` (золотой/желтый), `Reference` (серый/строгий).
4. **Telemetry-specific UI**:
   - **Sync Chart Panel**: Контейнер для графика с shared tooltip и zoom interaction.
   - **Corner Row Item**: Строка таблицы с мини-картой поворота и дельтой времени на нем.
   - **Insight Card**: Карточка с иконкой проблемы (напр. педаль тормоза) и текстом «Braked 15m too late».
5. **Feedback**: 
   - Skeleton loaders (имитируют графики) на время обработки файла.
   - Toast-уведомления успешного парсинга.

## Section 5 — Page-by-page wireframes

### 1. App shell / layout
- **Где**: Слева узкое меню навигации (Upload, History, Settings). Сверху Header с контекстом страницы.
- **Поведение**: Основной контент-контейнер скроллится независимо, графики масштабируются по ширине.

### 2. Upload page
- **Структура**: Огромная Dropzone по центру -> Ссылка/текст "Supported formats: .duckdb" -> Кнопка "Browse files".
- **CTA**: Drag & Drop файл.
- **Процесс**: При загрузке Dropzone заменяется на Progress Card со статусами: `Uploading`, `Reading database...`, `Extracting laps...`.

### 3. Sessions list page
- **Структура**: Таблица сессий.
- **Иерархия**: Трек -> Машина -> Дата -> Лучший круг -> Количество кругов.
- **CTA**: Клик на любую строку для перехода в Session Detail.
- **Empty state**: Заглушка по центру "No sessions yet. Upload a .duckdb file to start analysis".

### 4. Session detail / laps page
- **Структура**: Header с инфой о треке. Карточки суммарной информации по сессии сверху, таблица всех кругов сессии ниже.
- **Иерархия**: Выделен Best Lap. В колонках - Lap Time, Sectors и валидность.
- **CTA**: У каждого круга кнопка "Set as reference" и "Compare vs Reference".

## Section 6 — Compare page deep dive
**Рекомендация по MVP Layout:** Stacked vertically charts, shared X-axis (Distance) + Split Layout (Insights on Right Sidebar).

- **Почему Stacked vertically?** Это стандарт в анализе автоспорта. Наложение скорости, тормоза и газа на *один* график превращается в кашу. Вертикальный стак (Speed сверху, Throttle/Brake ниже, Steering в самом низу) с синхронизированным X-axis позволяет вести курсором мыши сверху вниз по одному моменту дистанции.
- **Размещение Layout:**
  - Левая часть (75% ширины): Вертикальный стак графиков, отсортированных по важности (1. Время дельты, 2. Скорость, 3. Тормоз/Газ).
  - Правая часть: Фиксированный Sidebar (25% ширины) с табами `Corners` и `Insights`. Позволяет быстро кликать на проблемный поворот в списке и видеть контекст, не теряя графики.
  - Header: 2 селектора кругов (Ref & Compare) + их базовые тайминги на липкой шапке.
- **Interaction (Синхронизация зума):** Клик на карточку инсайта "Corner 4: поздний газ" справа -> происходит мгновенный Zoom по оси X (Distance) от входа до выхода из 4-го поворота на *всех* stacked-графиках одновременно. Щелчок правой кнопкой мыши по графику сбрасывает зум.

## Section 7 — States and edge cases
- **Processing state**: Вместо простого крутящегося спинера нужны текстовые "умные" статусы процесса, чтобы дать пользователю ощущение сложной работы бекэнда и data pipeline'а.
- **Unsupported track**: Показать желтый баннер «Track insights unavailable. Fallback to raw telemetry applied.» в шапке страницы сравнения.
- **Generic Backend Error**: Toast или Red Banner. Кнопка "Retry Upload" с сохранением файла в локальном кэше / сессии, чтобы не заставлять грузить заново.

## Section 8 — Visual direction

**Option A: Premium dark telemetry workspace**
- *Стиль:* Глубокий темный фон, моноширинные цифры, акцент на графики, цветные дельты (Neon Green/Red).
- *Сила:* Максимальная читаемость разноцветных линий графиков, нулевая усталость глаз, эстетика "Pro" автоспортивного дата-центра.
- *Риски:* Визуальная строгость может отпугнуть новичков.

**Option B: Motorsport SaaS**
- *Стиль:* Светлая тема, контрастные белые карточки. Ярко-красные (Ferrari/F1) акцентные элементы интерфейса.
- *Сила:* Выглядит как современный Consumer-SaaS (например, Strava/Garmin Connect).
- *Риски:* Для графиков телеметрии светлый фон обычно плох, так как желтые и светло-зеленые линии на нем сливаются и "выгорают".

**Option C: Minimal analytical cockpit**
- *Стиль:* Ультра-монохром. Только черный, белый и серый. Цвета появляются только там, где есть потеря/выигрыш.
- *Риски:* Трудно различить 4 линии телеметрии на stacked графиках без уникальной цветовой кодировки каналов.

## Section 9 — Recommended design direction
**Окончательный выбор: Option A (Premium dark telemetry workspace)**
Это решение идеально покрывает продуктовый запрос про *"modern SaaS, performance tooling, premium racing product"*.
Графики нуждаются в качественной цветовой кодировке. Наложение нескольких каналов данных на белом фоне вызовет напряжение глаз и трудности в восприятии, в то время как темный фон дает нужный "поп-эффект" для цветных линий телеметрии.

## Section 10 — Figma structure proposal
Для организации структуры в Figma рекомендуется:
1. **Cover** — Превью проекта.
2. **README** — Инструкции, UX принципы.
3. **Foundation** — Цвета, Шрифты, Сетка.
4. **Components: Core** — Кнопки, Карточки, Таблицы, Поля ввода.
5. **Components: Telemetry** — Графики, Легенда, Insighs-карточки.
6. **Layouts** — App Shell, Header, Sidebar.
7. **Flows:**
   - `01_Upload` (Dropzone, Processing states)
   - `02_Sessions` (List, Detail view)
   - `03_Compare` (Главный экран, Zoom states, взаимодейсвия)

## Section 11 — Handoff guidance for frontend
- **Tech Stack (Next.js + TS):** Рекомендуется использовать App Router.
- **Styling:** Идеально подойдет `Tailwind CSS`. Настройте ваш `tailwind.config.ts`, расширив секцию `colors` под Dark Mode First (задав кастомные цвета: surface, main, accent, telemetry-speed).
- **Typography:** Используйте `next/font/google` для загрузки `Inter` и `JetBrains Mono`. Применяйте моноширинный шрифт к числам и таймерам (напр. через класс `font-mono lining-nums tabular-nums border-collapse`).
- **Charts (КРИТИЧЕСКИ ВАЖНО):** Для графиков телеметрии (огромное количество Data Points) категорически не подойдут популярные SVG-библиотеки вроде Recharts. Рекомендуется использовать Canvas-ориентированные компоненты: **uPlot** (молниеносный рендеринг миллионов точек), **Lightweight Charts** от TradingView или **Apache ECharts** (с `renderer: 'canvas'`).
- **Interaction Synchronization:** Для синхронизации Hover state на stacked графиках нужно поднимать состояние `hoveredDistanceX` над графиками (на уровень компонента-обертки `CompareWorkspace`), который будет раздавать его во все дочерние графики через пропсы или Context API.
