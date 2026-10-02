/* =========================================================
   Оркестровка страницы: одна непрерывная scroll-история.

   S0 логотип → S1 маскот → S2 текст → S3 уход маскота
   → S4 двенадцать выпусков → S5 две двери.

   Прогресс каждой сцены считается от её собственного трека,
   на его основе двигаются слои. Никаких скачков между блоками:
   фон сквозной, меняется только то, что на нём.
   ========================================================= */
(function (ns) {
  'use strict';

  const q = sel => document.querySelector(sel);

  /* «Узкая» раскладка — одна колонка текста и веер внизу. Это телефон
     в любом положении И планшет, стоящий вертикально: на нём ширины
     тоже не хватает на две колонки вокруг маскота. */
  const NARROW_MQ = '(max-width: 900px), (max-width: 1279px) and (orientation: portrait)';
  /* MediaQueryList создаём один раз: он живой и сам следит за окном,
     а isNarrow() спрашивается по несколько раз за кадр */
  const narrowMQ = window.matchMedia(NARROW_MQ);
  const isNarrow = () => narrowMQ.matches;

  /* ---------------------- высота экрана ------------------------
     ВАЖНО: высоту берём у самой сцены, а не у окна.

     Закреплённый блок сцены задан в CSS как 100lvh — это «большой»
     экран, со спрятанной адресной строкой, и он НЕ меняется. А
     window.innerHeight на телефоне растёт прямо во время прокрутки
     вниз, когда браузер прячет адресную строку. Пока кадр считался по
     окну, в этот момент менялись сразу все величины — и прогресс
     сцены, и линия веера, и посадка маскота: связка «кот + колода»
     заметно дёргалась ровно там, где адресная строка уезжает.
     Теперь одна и та же высота у CSS и у скрипта. */
  let vhFix = 0;
  function measureVh() {
    const pin = (el && (el.issuesPin || el.heroPin));
    vhFix = (pin && pin.offsetHeight) || window.innerHeight;
    measureLvh();
    return vhFix;
  }
  const viewH = () => vhFix || window.innerHeight;
  /* НАСТОЯЩАЯ видимая высота окна — для всего, что ставится на нижнюю
     кромку экрана. С тех пор как сцена задана в 100lvh, это та же
     величина, что и viewH(): окно никогда не бывает выше «большого»
     экрана. Оставлено как страховка — если браузер когда-нибудь
     отдаст окно выше сцены, низ веера всё равно сядет на кромку.
     Меряется не в кадре, а вместе с остальной раскладкой. */
  const viewFull = () => Math.max(viewH(), window.innerHeight || 0);
  /* ВЫСОТА, КОТОРОЙ МЕРЯЕТ САМ БРАУЗЕР в медиазапросах: это «большой»
     экран, со спрятанной адресной строкой, и он тоже не меняется во
     время прокрутки. Режимы раскладки считаем именно по ней — иначе
     колонки расставит скрипт по одному условию, а кегли подставит CSS
     по другому: на планшете, где адресная строка занимает ~6 % высоты,
     первый экран собирался десктопной раскладкой с альбомными кеглями.
     Меряем скрытой пробой ростом 100lvh — ровно то же, что видит CSS.
     Сцена теперь задана той же величиной, поэтому viewH(), viewCss()
     и viewFull() на экране совпадают; проба остаётся отдельной, чтобы
     режимы не зависели от того, успела ли сцена смериться. */
  let lvhFix = 0, lvhProbe = null;
  function measureLvh() {
    if (!lvhProbe && document.body) {
      lvhProbe = document.createElement('div');
      lvhProbe.setAttribute('aria-hidden', 'true');
      lvhProbe.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;' +
                               'height:100lvh;visibility:hidden;pointer-events:none';
      document.body.appendChild(lvhProbe);
    }
    lvhFix = (lvhProbe && lvhProbe.offsetHeight) || 0;
    return lvhFix;
  }
  /** высота экрана в понимании CSS; пока проба не снята — высота сцены */
  const viewCss = () => lvhFix || viewH();
  ns.viewCss = viewCss;          // тем же признаком пользуется js/issues.js
  /* Телефон лёжа: ширина есть, высоты нет. */
  const isFlat = () => viewCss() <= 560 && window.innerWidth > viewCss();
  /* Альбомная ориентация уже десктопа: телефон и планшет лёжа.
     Там первый экран собирается двумя колонками вокруг маскота
     (layoutHeroLand), а не одной колонкой сверху вниз. */
  /* Признак — не только ширина. Планшет 13″ лёжа это 1366×1024: по
     ширине он «десктоп», но экран у него 4:3, и просторная десктопная
     композиция на нём расползается. Поэтому альбомная раскладка
     включается на всём горизонтальном, что уже 1280 px, И на широких,
     но НЕ вытянутых экранах. На настоящем десктопе (16:10 и шире)
     остаётся прежняя композиция. */
  const LAND_RATIO = 1.45;
  const isLand = () => {
    const vw = window.innerWidth, vh = viewCss();
    if (!vh || vw <= vh) return false;           // вертикальный экран
    return vw < 1280 || vw / vh < LAND_RATIO;
  };

  /* ---------- фазы сцены S0–S3, доли прогресса трека ---------- */
  const PH = {
    logoOut:   [0.05, 0.20],   // логотип уезжает в левый верхний угол
    rise:      [0.12, 0.34],   // маскот поднимается и дорастает до размера
    reveal:    [0.38, 0.60],   // пауза, затем текст порциями
    cta:       [0.60, 0.66],   // и переход к выпускам
    textOut:   [0.69, 0.80]    // тексты гаснут по одному, до выхода веера
  };
  const OUT_STEP = 0.022;      // сдвиг между уходами соседних блоков
  const OUT_SPAN = 0.038;      // и длительность ухода одного блока

  /* Передача сцены S3 → S4, в долях трека выпусков.
     Треки наложены так, что fanIn начинается ровно на hp ≈ 0.80. */
  const TR = {
    fanIn: [0.000, 0.055],     // веер выезжает снизу, без прозрачности
    lift:  [0.055, 0.105],     // и дальше поднимается уже вместе с котом
    carry: [0.105, 0.165],     // кот и веер уносятся по дуге
    back:  [0.165, 0.205]      // веер возвращается по дуге, уже с заголовками
  };
  /* На узком и низком экране маскот мельче, а ужимается он сильнее:
     за короткий подъём это читалось как рывок «большая голова →
     маленькая». Там ту же дорогу проходим медленнее. */
  const TR_SLOW = {
    fanIn: [0.000, 0.050],
    lift:  [0.050, 0.150],
    carry: [0.150, 0.200],
    back:  [0.200, 0.235]
  };
  /* Вертикальный экран: перелёт длиннее — за него мимо маскота должны
     пройти все двенадцать обложек. Телефона ЛЁЖА это не касается:
     там лента короткая и упирается в края экрана. */
  const TR_TALL = {
    fanIn: [0.000, 0.050],
    lift:  [0.050, 0.150],
    carry: [0.150, 0.230],
    back:  [0.230, 0.265]
  };
  const tr = () => (isFlat() ? TR_SLOW : isNarrow() ? TR_TALL : TR);
  const TOP_ENTER = 1.08;      // стартовая кромка веера: вся колода под экраном
  const IP0 = () => tr().back[1];
  const IP = [0.205, 0.80];    // выпуски 01 → 12
  /* Уход сцены выпусков: СНАЧАЛА гаснет текст, ПОТОМ уезжает колода.
     Раньше оба шага шли вместе, и уезжающая двенадцатая обложка
     проходила прямо по ещё видимому заголовку и описанию. Теперь
     текст гаснет быстро и к началу отъезда его уже нет; общая длина
     ухода осталась прежней. */
  const TEXT_OFF = [0.800, 0.829];  // заголовок и описание гаснут первыми
  const DEPART   = [0.826, 0.870];  // и только потом уезжает колода
  const PIN_OFF  = [0.92, 0.98];   // и вся сцена выпусков

  let issuesRef = null;        // ссылка на веер; появляется после его создания
  let swapTimer = 0;           // таймер подмены текста выпуска
  const SPIN = 38;             // доворот на уходе, градусы
  /* На вертикальном экране лента уезжает ДЛИННЕЕ: за перелёт мимо
     маскота должны пройти все двенадцать обложек, а не три. Угол
     считаем по самой ленте — шаг между картами и место маскота в ней
     знает js/issues.js, поэтому проезд одинаков на любом экране:
     от обложки под маскотом до двенадцатой плюс небольшой запас,
     чтобы она успела уйти за левый край. */
  const STRIP_TAIL = 22;       // запас после двенадцатой, градусы
  function stripSpin() {
    if (!issuesRef || !issuesRef.stripStep) return SPIN;
    const st = issuesRef.stripStep();
    if (!st) return SPIN;
    return st * (issuesRef.count - 1 - issuesRef.catIndex) + STRIP_TAIL;
  }
  const RET  = 24;             // доворот на возврате: ровно чтобы уйти за кадр
  const TOP_NORM = 0.60;       // рабочее положение веера в сцене выпусков
  /* На узком экране номер, название и пояснение стоят вверху, поэтому
     веер опускается: линию считаем так, чтобы верх фокусной обложки
     встал точно под текстом, с одинаковым зазором на любом телефоне.
     Подъём активной карты и её увеличение учтены — иначе она наезжает
     на заголовок именно там, где текста больше всего. */
  const ACT_LIFT = 0.12, ACT_SCALE = 1.16;
  /* коэффициент увеличения фокусной обложки живёт в js/issues.js;
     здесь держим ссылку, чтобы линия веера считалась по нему же */
  let actScale = () => ACT_SCALE;
  /* высота текстового блока, по которой посчитана линия веера:
     описание выпуска подставляется уже после расчёта, поэтому кадр,
     на котором оно изменилось, надо пересчитать */
  let infoUsed = -1;
  /* «подпись» первого экрана и счётчик пересборок — их ведёт сторож
     раскладки (heroGuard ниже); объявлены здесь, потому что подпись
     обновляется в конце alignBlocks(), а он вызывается раньше */
  let heroSig = '', heroRuns = 0;
  /* ---------------- замеры раскладки ----------------
     Всё, что не меняется от кадра к кадру, меряем один раз и держим
     в переменных. Раньше каждый кадр читались offsetHeight маскота,
     getComputedStyle логотипа и веера, getBoundingClientRect текста —
     и всё это ПОСЛЕ записи стилей. Браузер был вынужден пересчитывать
     раскладку синхронно посреди кадра, кадры терялись, и уход маскота
     читался как дрожь. */
  let catHFix = 0, catWFix = 0, limitFix = 0, fanChFix = 0, infoLowFix = 0;
  /** низ текстового блока выпуска относительно верха закреплённой сцены */
  function infoLow() { return el.info.offsetTop + el.info.offsetHeight; }
  /** низ шапки сцены выпусков (счётчик и риски) */
  function headLow() {
    return el.head ? el.head.offsetTop + el.head.offsetHeight : 0;
  }
  function cacheMetrics() {
    catHFix = el.cat.offsetHeight || viewH() * 0.7;
    catWFix = el.cat.offsetWidth || viewH() * 0.5;
    limitFix = logoLimit();
    fanChFix = parseFloat(getComputedStyle(el.fan).getPropertyValue('--ch')) || 0;
    infoLowFix = infoLow();
  }
  function topNorm() {
    /* На десктопе веер стоит на своей постоянной линии. На любом
       другом экране (вертикальный и планшет лёжа) он встаёт на нижнюю
       кромку — расчёт ниже. */
    if (!isNarrow() && !isFlat() && !isLand()) return TOP_NORM;
    const vh = viewH();
    const ch = fanChFix;
    const info = infoLowFix;
    if (!vh || !ch || !info) return TOP_NORM;
    /* Телефон лёжа: текст стоит слева, веер уведён правее него
       (js/issues.js), поэтому опускать его под текст не нужно — но
       нижней кромки он держится так же, как везде: низ фокусной
       обложки совпадает с низом экрана. Раньше здесь считалась своя
       линия по середине высоты, и внизу оставалась пустая полоса. */
    /* доля высоты сцены, на которой проходит НАСТОЯЩАЯ нижняя кромка
       экрана: со спрятанной адресной строкой она ниже сцены */
    const bottom = viewFull() / vh;
    if (isFlat()) {
      const CHf = ch * actScale();
      return clamp(bottom + ACT_LIFT - (ch + CHf) / (2 * vh), 0.28, 1.10);
    }
    infoUsed = info;
    /* Вертикальный экран: веер стоит НА нижней кромке — низ фокусной
       обложки совпадает с низом экрана, а ряд соседних обложек чуть
       свешивается за неё. Раньше линия считалась только от текста,
       и веер повисал в середине, оставляя внизу пустую полосу.
       Фокусная обложка при этом крупная (доля ширины экрана, см.
       js/issues.js), поэтому её размер входит в расчёт. */
    const sc  = actScale();
    const gap = vh * 0.035;
    const CH  = ch * sc;
    const want  = bottom + ACT_LIFT - (ch + CH) / (2 * vh);
    /* нижний предел: верх фокусной обложки не заходит на описание */
    const under = (info + gap - ch / 2 + CH / 2 + vh * ACT_LIFT) / vh;
    return clamp(Math.max(want, under), 0.40, 1.10);
  }
  /* На перелёте линия веера считается от РОСТА маскота, а не от высоты
     экрана: иначе на планшете и телефоне, где кот мельче, колода
     закрывает его целиком. За веер уходит одна и та же доля фигуры. */
  /* Мягкий предел вместо обычного clamp: в точке упора у clamp ломается
     скорость, и на быстром уходе маскота это читалось как лёгкий рывок
     размера. Здесь производная гасится плавно, излом исчезает. */
  const SOFT_K = 0.06;
  function softClamp(v, lo, hi, k) {
    if (v > hi - k) { const d = (hi - v + k) / (2 * k); v = d <= 0 ? hi : hi - k * d * d; }
    if (v < lo + k) { const d = (v - lo + k) / (2 * k); v = d <= 0 ? lo : lo + k * d * d; }
    return v;
  }
  const CAT_SINK = 0.28;       // какая часть маскота скрыта за колодой
  const CAT_FIT_MIN = 0.78;    // предел уменьшения, чтобы уйти из-под логотипа
  const CAT_GAP = 0.34;        // зазор до логотипа, в долях внешнего отступа

  /* фазы закрывающей сцены, в долях её трека */
  const OU = {
    railIn:  [0.55, 0.97],   // по ходу въезда сцены, не по её прогрессу
    claim:   [0.26, 0.46],
    railOut: [0.38, 0.54],
    doors:   [0.50, 0.70],
    foot:    [0.66, 0.82]
  };
  /* На телефоне блоки занимают почти весь экран, и наложение двух
     соседних читается как каша. Поэтому там они сменяются встык:
     строки статистики уходят раньше, чем появляется утверждение. */
  const OU_NARROW = {
    railIn:  [0.55, 0.97],
    claim:   [0.44, 0.60],
    railOut: [0.30, 0.46],
    doors:   [0.60, 0.76],
    foot:    [0.74, 0.88]
  };
  const ou = () => (isNarrow() || isFlat() ? OU_NARROW : OU);

  const el = {
    brand:  q('#brand'),
    cat:    q('#heroCat'),
    text:   q('#heroText'),
    lines:  Array.from(document.querySelectorAll('.hero__line')),
    hint:   q('#heroHint'),
    cta:    q('#heroCta'),
    heroTrack:   q('[data-track="hero"]'),
    issuesTrack: q('[data-track="issues"]'),
    fan:    q('#fan'),
    ticks:  q('#ticks'),
    info:   q('#issueInfo'),
    num:    q('#issueNum'),
    title:  q('#issueTitle'),
    desc:   q('#issueDesc'),
    counter:q('#counterNow'),
    head:   q('.issues__head'),
    rail:   q('#rail'),
    claim:  q('#claim'),
    doors:  q('#doors'),
    foot:   q('#foot'),
    outroTrack: q('[data-track="outro"]'),
    tools:  q('.tools'),
    dot:    q('#cursorDot'),
    issuesPin: q('.scene--issues .scene__pin'),
    heroPin:   q('.scene--hero .scene__pin')
  };

  /* ---------------- прогресс сцен ----------------
     Кадр НЕ трогает раскладку: положение треков в документе меряется
     один раз (и заново на настоящем resize), а в кадре берётся только
     window.scrollY. Раньше каждый кадр вызывался getBoundingClientRect
     у трёх треков — браузер пересчитывал раскладку синхронно, кадры
     терялись, а на телефоне замер ещё и расходился с тем положением
     прокрутки, по которому в этот момент собиралась картинка. */
  const geo = { hero: [0, 0], issues: [0, 0], outro: [0, 0] };
  function measureTracks() {
    const sy = window.scrollY;
    [['hero', el.heroTrack], ['issues', el.issuesTrack], ['outro', el.outroTrack]]
      .forEach(([k, t]) => {
        if (!t) return;
        geo[k][0] = t.getBoundingClientRect().top + sy;   // верх трека в документе
        geo[k][1] = t.offsetHeight;
      });
  }
  /** прогресс 0…1 внутри залипающего трека */
  function progressAt(key, vh, sy) {
    const g = geo[key];
    const total = g[1] - vh;
    if (total <= 0) return 0;
    return clamp01((sy - g[0]) / total);
  }

  /* ------------------------ язык -------------------------------
     Русская и английская версии отличаются только содержимым:
     тексты сцен и комплект обложек. Раскладка, размеры, шрифт и
     вся анимация общие — их язык не трогает.                    */
  const LANG_KEY = 'catalyst-lang';
  const langBtn  = q('#langBtn');
  const langIcon = q('#langIcon');
  let lang = 'ru';
  const dict = () => ns.text[lang];

  /* ------------------------- тема ------------------------------
     Переключатель в правом верхнем углу. Меняются только цвета и
     логотип; раскладка, сцены и анимации остаются прежними.     */
  const THEME_KEY = 'catalyst-theme';
  const themeBtn  = q('#themeBtn');
  const themeIcon = q('#themeIcon');
  const brandPic  = el.brand.querySelector('img');

  function applyTheme(name) {
    const light = name === 'light';
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    brandPic.src  = 'assets/logo/logo-' + (light ? 'black' : 'white') + '.png';
    themeIcon.src = 'assets/ui/switch-' + (light ? 'light' : 'dark') + '.png';
    if (themeBtn) themeBtn.setAttribute('aria-pressed', String(light));
  }

  /* по умолчанию — тёмная тема; дальше страница помнит выбор посетителя */
  let theme = 'dark';
  try { theme = localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) {}
  applyTheme(theme);

  if (themeBtn) themeBtn.addEventListener('click', () => {
    theme = theme === 'light' ? 'dark' : 'light';
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  });

  /* ------------------------ логотип ---------------------------
     Стартует по центру экрана. За фазу handover уезжает в левый
     верхний угол и уменьшается; дальше остаётся там до конца
     страницы (элемент fixed, вне залипающих сцен).            */
  const brandImg = el.brand.querySelector('img');
  /* cx/cy — куда уводится знак В НАЧАЛЕ страницы, к центру экрана.
     Конечное положение — угол — задано раскладкой (см. .brand в CSS)
     и в счёте не участвует вовсе. */
  let cx = 0, cy = 0, bs = 1;

  function measureBrand() {
    const w = brandImg.offsetWidth, h = brandImg.offsetHeight;
    if (!w || !h) return;
    const pad = parseFloat(getComputedStyle(el.brand).paddingLeft) || 32;
    const target = Math.max(104, Math.min(168, window.innerWidth * 0.10));
    bs = target / w;
    /* Отсюда и до центра экрана знак уводится на первом экране.
       Ошибка в этих числах сдвигает только стартовое положение —
       в углу знак стоит по раскладке и ни от какого замера не
       зависит. */
    const box = el.brand.getBoundingClientRect();
    const boxW = box.width  || window.innerWidth;
    const boxH = box.height || viewH();
    cx = boxW / 2 - w / 2 - pad;
    cy = boxH / 2 - h / 2 - pad;
    const root = document.documentElement.style;
    root.setProperty('--brand-w', Math.round(target) + 'px');
    root.setProperty('--brand-h', Math.round(h * bs) + 'px');
    alignTools(pad, h * bs);
  }
  /* Кнопки языка и темы стоят на одной линии с серой чертой логотипа.
     Черта проходит по 46.59 % высоты знака (замерено по assets/logo),
     поэтому её положение считаем от реальной высоты логотипа в углу,
     а кнопки центрируем по ней. Так линия совпадает на любом экране. */
  const BRAND_LINE = 355 / 762;
  function alignTools(pad, brandH) {
    if (!el.tools || !brandH) return;
    const th = el.tools.getBoundingClientRect().height;
    if (!th) return;
    el.tools.style.top = Math.round(pad + BRAND_LINE * brandH - th / 2) + 'px';
  }
  measureBrand();
  /* Логотип задаёт --brand-w/--brand-h, а от них зависит вся раскладка
     первого экрана: и отступ колонки, и подбор высоты цифры «12».
     Пока картинка логотипа не загрузилась, размеры у него запасные,
     поэтому после её прихода мало пересчитать кадр — нужен полный
     пересчёт раскладки (relayout). Слушатель ставим без условия:
     при смене темы подставляется другой файл логотипа, и событие
     приходит снова. */
  brandImg.addEventListener('load', () => { measureBrand(); relayout(); });
  /* высота пилюль известна только после загрузки их картинок */
  Array.from(el.tools ? el.tools.querySelectorAll('img') : []).forEach(im => {
    if (!im.complete) im.addEventListener('load', measureBrand);
  });

  /* --------- «12» и текст рядом: одна высота ---------
     Меряем по ОПТИЧЕСКИМ границам строки, а не по краям краски:
     верх строчной (высота буквы «x») первой строки совпадает с верхом
     цифры, базовая линия последней строки — с её низом. Выносные
     элементы при этом слегка выходят за цифру, и это правильно: иначе
     в языке с выносными (английский: «d» вверх, «y» вниз) весь блок
     оптически проваливается внутрь цифры, а в языке без них
     (русский) — нет. Величины зависят от метрик реального шрифта и
     кегля, поэтому считаем их в рантайме по холсту.              */
  const big = q('.hero__big'), countTxt = q('.hero__count-txt');
  const probe = document.createElement('canvas').getContext('2d');

  /** метрики строчного бокса узла для заданной пробы */
  function ink(node, sample) {
    const cs = getComputedStyle(node);
    const F  = parseFloat(cs.fontSize);
    const LH = parseFloat(cs.lineHeight) || F;
    probe.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + F + 'px ' + cs.fontFamily;
    const m = probe.measureText(sample);
    const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
    if (!asc) return null;
    const half = (LH - (asc + desc)) / 2;
    return {
      F: F, LH: LH,
      top:      half + asc - m.actualBoundingBoxAscent,   // верх краски от верха бокса
      baseline: half + asc,                               // базовая линия от верха бокса
      inkAsc:   m.actualBoundingBoxAscent,
      inkDesc:  m.actualBoundingBoxDescent
    };
  }

  /** строки блока: считаем только по ВИДИМЫМ переносам — часть из них
      выключена на текущей ширине (классы .wide / .tight / .brk) */
  function textLines(node) {
    const parts = [];
    let cur = '';
    node.childNodes.forEach(n => {
      if (n.nodeType === 1 && n.tagName === 'BR') {
        if (getComputedStyle(n).display !== 'none') { parts.push(cur); cur = ''; }
        return;
      }
      cur += n.textContent;
    });
    parts.push(cur);
    const out = parts.map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return out.length ? out : [node.textContent.trim()];
  }

  /** высота строчной («x») — оптический верх строки без выносных */
  function xHeight(node) {
    const cs = getComputedStyle(node);
    probe.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' +
                 parseFloat(cs.fontSize) + 'px ' + cs.fontFamily;
    return probe.measureText('x').actualBoundingBoxAscent;
  }

  /* Ведущий здесь ТЕКСТ: его кегль и интерлиньяж заданы макетом, а
     цифра подгоняется под его оптическую высоту — от верха строчной
     первой строки до базовой линии последней. Так на любом экране и в
     любом языке блок читается как один прямоугольник, а число строк
     может быть любым. */
  const BIG_MIN = 0.48, BIG_MAX = 1.80;   // предел изменения кегля цифры
  /* Доля ширины блока, больше которой цифра не растёт. Там, где текст
     её ОБТЕКАЕТ (вертикальный экран), запас меньше: цифра отнимает
     ширину у всей колонки. Там, где она стоит с текстом в одной
     строке flex (десктоп и альбомная раскладка), можно чуть больше —
     иначе на узкой колонке цифра не дотягивается до трёх строк. */
  const BIG_COL_FLOW = 0.28, BIG_COL_ROW = 0.34;
  /* второй абзац блока «12»: на узком экране он идёт тем же потоком,
     что и подпись рядом с цифрой, поэтому участвует в подгонке */
  const numP = q('.hero__line--num .hero__p');
  /* ---------- высота цифры «12» = высоте текста рядом ----------

     Один алгоритм на все раскладки. Ведущий здесь ТЕКСТ: его кегль и
     интерлиньяж заданы макетом, цифра подгоняется под ОПТИЧЕСКУЮ
     высоту колонки рядом — от верха строчной первой строки до базовой
     линии последней. Высота считается по фактическим строкам
     (getClientRects), а не по высоте блока: так она верна и когда
     колонка — один поток из подписи и следующего абзаца (вертикальный
     экран), и когда рядом с цифрой стоит только подпись (десктоп
     и альбомная раскладка).

     Подбор итеративный: кегль цифры меняет ширину колонки (текст её
     обтекает или стоит с ней в одной строке flex), ширина меняет
     число строк, число строк — нужную высоту цифры. Цикл идёт до
     неподвижной точки.

     Два ограничителя:
       BIG_MIN/BIG_MAX — предел кегля относительно базового;
       BIG_COL         — доля ширины блока, больше которой цифра
                         не растёт, иначе она съедает колонку.
     Если цифра упирается в BIG_COL, а колонка всё ещё выше её —
     там, где цифра обтекается текстом, ужимается сам текст в этом
     блоке (шаг K_STEP, предел K_MIN): строк становится меньше,
     и цифра догоняет колонку, оставаясь в своей доле ширины. */

  /** строки колонки: по одной записи на видимую строку текста */
  function colRows(nodes) {
    const rows = [];
    nodes.forEach(n => {
      if (!n) return;
      const r = document.createRange();
      r.selectNodeContents(n);
      Array.from(r.getClientRects()).forEach(b => {
        if (b.height <= 2) return;
        if (!rows.some(v => Math.abs(v - b.top) < 3)) rows.push(b.top);
      });
    });
    return rows.sort((a, b) => a - b);
  }

  function alignCount() {
    if (!big || !countTxt) return;
    /* сброс всего, что подогнали прошлым проходом */
    countTxt.style.marginTop = '0px';
    countTxt.style.lineHeight = '';
    countTxt.style.fontSize = '';
    big.style.fontSize = ''; big.style.marginTop = ''; big.style.height = '';
    if (numP) numP.style.fontSize = '';
    const block = big.closest('.hero__line');
    if (block) block.style.fontSize = '';

    /* цифру обтекает текст только на вертикальном экране: там рядом
       с ней стоит вся колонка — подпись и следующий абзац */
    const flow = isNarrow() && !isLand();
    const col  = flow ? [countTxt, numP] : [countTxt];
    const colW = block ? block.clientWidth : 0;
    const base = parseFloat(getComputedStyle(big).fontSize);
    const tb0  = parseFloat(getComputedStyle(countTxt).fontSize);
    if (!base || !tb0) return;

    /** кегль текста в блоке (и «распорку» блока — от неё шаг строк) */
    function setTextSize(px) {
      const v = px ? px.toFixed(2) + 'px' : '';
      if (block) block.style.fontSize = v;
      countTxt.style.fontSize = v;
      if (numP) numP.style.fontSize = v;
    }
    /** подогнать кегль цифры под текущую колонку */
    function fitDigit() {
      for (let pass = 0; pass < 5; pass++) {
        const t = ink(countTxt, 'x'), d = ink(big, big.textContent);
        if (!t || !d) return null;
        const rows = colRows(col);
        if (!rows.length) return null;
        const x = xHeight(countTxt) || t.inkAsc;
        const target = (rows[rows.length - 1] - rows[0]) + x;
        /* высота краски цифры — знаменатель: если шрифт ещё не дал
           метрик, подбор пропускаем, иначе в стиль ушло бы "NaNpx"
           и правило молча отбросилось бы */
        const den = d.inkAsc + d.inkDesc;
        if (!(den > 0) || !(target > 0)) return null;
        const size = clamp(d.F * target / den,
                           base * BIG_MIN, base * BIG_MAX);
        if (Math.abs(size - d.F) < 0.3) break;
        big.style.fontSize = size.toFixed(2) + 'px';
      }
      const t = ink(countTxt, 'x'), d = ink(big, big.textContent);
      if (!t || !d) return null;
      return { t: t, d: d, rows: colRows(col),
               w: big.getBoundingClientRect().width };
    }

    const bigCol = flow ? BIG_COL_FLOW : BIG_COL_ROW;
    /* Если цифра упёрлась в свою долю ширины, а колонка всё ещё выше —
       ужимаем кегль текста В ЭТОМ блоке: строк становится меньше,
       и цифра догоняет колонку. В раскладке «в одну строку» запас
       меньше: там кегль задан макетом и заметно отличаться от
       остального набора не должен. */
    const K_MIN = flow ? 0.84 : 0.88, K_STEP = 0.02;
    let r = null;
    for (let k = 1; k >= K_MIN - 1e-6; k -= K_STEP) {
      setTextSize(k === 1 ? 0 : tb0 * k);
      big.style.fontSize = '';
      r = fitDigit();
      if (!r) return;
      if (!colW || r.w <= colW * bigCol + 0.5) break;   // цифра помещается
    }

    /* цифра всё ещё шире своей доли — режем по ширине: лучше чуть
       меньшая цифра, чем колонка в треть блока */
    if (colW && r.w > colW * bigCol) {
      const wPer = r.w / r.d.F;
      if (wPer > 0) {
        big.style.fontSize = (colW * bigCol / wPer).toFixed(2) + 'px';
        r = fitNoop();
        if (!r) return;
      }
    }
    function fitNoop() {
      const t = ink(countTxt, 'x'), d = ink(big, big.textContent);
      if (!t || !d) return null;
      return { t: t, d: d, rows: colRows(col),
               w: big.getBoundingClientRect().width };
    }

    /* Верх краски цифры — на верх строчной первой строки. Двигаем то,
       что стоит ВЫШЕ: у крупной цифры краска начинается ниже строчной,
       тогда опускаем текст; у мелкой — наоборот. */
    const x = xHeight(countTxt) || r.t.inkAsc;
    const firstX = r.t.baseline - x;          // от верха бокса строки
    const delta  = r.d.top - firstX;
    countTxt.style.marginTop = Math.max(0,  delta).toFixed(2) + 'px';
    big.style.marginTop      = Math.max(0, -delta).toFixed(2) + 'px';

    /* Цифру обтекают ВСЕ строки колонки: без явной высоты последняя
       уезжает под неё и колонка теряет левый край. */
    if (flow) {
      for (let pass = 0; pass < 3; pass++) {
        const h = Math.ceil(colRows(col).length * r.t.LH);
        if (Math.abs(parseFloat(big.style.height) - h) < 1) break;
        big.style.height = h + 'px';
      }
    }
  }
  /* --------- утверждение и примечание: одна высота ---------
     Правая колонка должна кончаться там же, где крупный заголовок
     слева. Сколько строк выйдет — зависит от ширины колонки и длины
     текста, а он в двух версиях разный, поэтому фиксированный
     интерлиньяж совпадает не на всякой ширине. Считаем в рантайме:
     сначала подбираем ширину колонки так, чтобы число строк дало
     естественный интерлиньяж, затем доводим его до точной высоты.
     Кегль не трогаем.                                            */
  const claimEl  = q('#claim'),
        claimHd  = q('.claim__head'),
        claimNt  = q('.claim__note');
  const CLH_MIN = 1.50, CLH_MAX = 2.05, CLH_IDEAL = 1.75;
  const CLH_WIDE_MIN = 1.34, CLH_WIDE_MAX = 2.40;   // запасной диапазон

  /** высота одного только текста примечания, без линейки и отступа над ней */
  function noteChrome() {
    const cs = getComputedStyle(claimNt);
    return (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.borderTopWidth) || 0);
  }
  function claimLines(lh) {
    return Math.max(1, Math.round(
      (claimNt.getBoundingClientRect().height - noteChrome()) / lh));
  }
  function setCol(w) {
    claimEl.style.gridTemplateColumns = 'minmax(0, 1fr) ' + w.toFixed(2) + 'px';
  }

  /** переносы, расставленные в тексте вручную (на узком экране выключены) */
  function claimBreaks() {
    return Array.prototype.filter.call(
      claimNt.querySelectorAll('br'),
      br => getComputedStyle(br).display !== 'none');
  }

  /** ширина колонки, при которой ни одна строка не переносится дальше */
  function fitBreaks(H) {
    const parts = textLines(claimNt);
    const n = parts.length;
    const cs = getComputedStyle(claimNt);
    probe.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' +
                 parseFloat(cs.fontSize) + 'px ' + cs.fontFamily;
    let w = 0;
    for (let i = 0; i < n; i++) w = Math.max(w, probe.measureText(parts[i]).width);
    w = Math.ceil(w) + 2;
    const room = claimEl.getBoundingClientRect().width * 0.62;
    if (!w || w > room) return false;
    /* холст меряет чуть иначе, чем раскладка: добираем ширину, пока
       строк не станет ровно столько, сколько переносов в тексте */
    const lh = H / n;
    claimNt.style.lineHeight = lh.toFixed(2) + 'px';
    for (let k = 0; k < 10; k++) {
      setCol(w);
      if (claimLines(lh) <= n) return true;
      w += 4;
      if (w > room) break;
    }
    claimNt.style.lineHeight = '';
    claimEl.style.gridTemplateColumns = '';
    return false;
  }

  /** одна попытка: цель H известна, ищем число строк и ширину колонки */
  function fitClaim(H, wDef, F, lh0, lo0, hi0) {
    const cands = [];
    for (let n = 2; n <= 12; n++) {
      const ratio = H / n / F;
      if (ratio < lo0 || ratio > hi0) continue;
      cands.push({ n: n, score: Math.abs(ratio - CLH_IDEAL) });
    }
    cands.sort((a, b) => a.score - b.score);

    for (let i = 0; i < cands.length; i++) {
      const n = cands[i].n;
      if (claimLines(lh0) !== n) {
        /* Нужна САМАЯ ШИРОКАЯ колонка, при которой текст ещё ложится
           в n строк: строки тогда набраны во всю ширину, без рваного
           правого края. Уже колонка — больше строк, поиск монотонный;
           lo держим на стороне «строк не меньше нужного». */
        let lo = wDef * 0.45, hi = wDef * 1.55;
        setCol(lo);
        if (claimLines(lh0) < n) { claimEl.style.gridTemplateColumns = ''; continue; }
        setCol(hi);
        const atHi = claimLines(lh0);
        if (atHi > n) { claimEl.style.gridTemplateColumns = ''; continue; }
        if (atHi === n) {                     // шире уже некуда — берём предел
          claimNt.style.lineHeight = (H / n).toFixed(2) + 'px';
          return true;
        }
        for (let k = 0; k < 24; k++) {
          const w = (lo + hi) / 2;
          setCol(w);
          if (claimLines(lh0) >= n) lo = w; else hi = w;
        }
        setCol(lo);
      }
      if (claimLines(lh0) === n) {
        claimNt.style.lineHeight = (H / n).toFixed(2) + 'px';
        return true;
      }
      claimEl.style.gridTemplateColumns = '';
    }
    return false;
  }

  function alignClaim() {
    if (!claimEl || !claimHd || !claimNt) return;
    claimEl.style.gridTemplateColumns = '';
    claimNt.style.lineHeight = '';
    /* На телефоне и планшете высоты не подгоняем: там заголовок просто
       стоит по нижнему краю правой колонки (align-items:end в CSS).
       Растягивать интерлиньяж на маленьком экране некуда. */
    if (window.innerWidth < 1280) return;
    /* на узком экране колонки складываются друг под друга — равнять нечего */
    const cols = getComputedStyle(claimEl).gridTemplateColumns.split(/\s+/);
    if (cols.length < 2) return;

    const wDef = parseFloat(cols[cols.length - 1]);
    const F    = parseFloat(getComputedStyle(claimNt).fontSize);
    const lh0  = parseFloat(getComputedStyle(claimNt).lineHeight) || F * CLH_IDEAL;
    if (!F || !wDef) return;

    /* Сужая или расширяя правую колонку, мы меняем ширину заголовка,
       а с ней и его высоту — то есть саму цель. Поэтому повторяем
       подгонку, пока цель не перестанет меняться. */
    for (let pass = 0; pass < 4; pass++) {
      /* цель: низ последней строки примечания — на низу заголовка,
         линейка сверху — на его верху, поэтому её вычитаем */
      const H = claimHd.getBoundingClientRect().height - noteChrome();
      if (!H) break;
      /* если переносы расставлены в тексте — держим именно их, колонку
         расширяем ровно под самую длинную строку; иначе подбираем
         число строк сами: штатный диапазон интерлиньяжа, при неудаче —
         расширенный */
      const ok = claimBreaks().length
        ? fitBreaks(H)
        : (fitClaim(H, wDef, F, lh0, CLH_MIN, CLH_MAX) ||
           fitClaim(H, wDef, F, lh0, CLH_WIDE_MIN, CLH_WIDE_MAX));
      if (!ok) break;
      if (Math.abs(claimHd.getBoundingClientRect().height - noteChrome() - H) < 0.5) return;
      claimNt.style.lineHeight = '';         // цель уехала — считаем заново
    }
    /* ни один вариант не лёг — оставляем штатную вёрстку */
    claimEl.style.gridTemplateColumns = '';
    claimNt.style.lineHeight = '';
  }

  /* --------- короткие слова не остаются в конце строки ---------
     На широком экране переносы расставлены вручную (класс .wide).
     Ниже 1280 px их нет, и текст ломается там, где придётся: предлог
     или артикль повисает в конце строки. Склеиваем такие слова со
     следующим неразрывным пробелом — правило одно для обоих языков.
     Склейка ограничена по длине: длинный неразрывный кусок вылезал бы
     за узкую колонку. */
  const TYPO_SEL = '.hero__h1, .hero__h2, .hero__h3, .hero__p,' +
                   '.hero__count-txt, .claim__head, .claim__note';
  const SHORT_W = 3;     // до трёх символов — предлоги, союзы, артикли
  const NB = '\u00A0';
  const rawText = new WeakMap();

  function bindShort(text, fits) {
    /* делим только по пробелам и табам: переводы строк из data.js —
       это заданные вручную переносы, их трогать нельзя */
    const parts = text.split(/([ \t]+)/);
    /* Тире не начинает строку: приклеиваем его к ПРЕДЫДУЩЕМУ слову —
       тогда оно остаётся в конце строки, как и положено по-русски.
       Иначе короткое «—» склеивалось со следующим словом и уезжало
       на новую строку вместе с ним: «Эта серия / — попытка собрать». */
    const DASH = /^[\u2014\u2013]$/;
    for (let i = 2; i < parts.length; i += 2) {
      if (DASH.test(parts[i]) && fits(parts[i - 2] + ' ' + parts[i])) parts[i - 1] = NB;
    }
    let run = '';                      // уже склеенный кусок
    for (let i = 0; i + 2 < parts.length; i += 2) {
      const bare = parts[i].replace(/^[«"„(\[]+/, '').replace(/[.,;:!?)»"\]]+$/, '');
      const cand = (run || parts[i]) + ' ' + parts[i + 2];
      if (bare && bare.length <= SHORT_W && !DASH.test(bare) && fits(cand)) {
        parts[i + 1] = NB;
        run = cand;
      } else {
        run = '';
      }
    }
    return parts.join('');
  }

  /** та же склейка, но по узлам: разметка (<br>, <span>) не трогается.
      Предел склейки — не число символов, а ширина колонки: длинный
      неразрывный кусок иначе вылезал бы за край. */
  function bindNode(node) {
    const cs = getComputedStyle(node);
    const room = node.getBoundingClientRect().width * 0.94;
    if (!room) return;
    probe.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' +
                 parseFloat(cs.fontSize) + 'px ' + cs.fontFamily;
    const fits = str => probe.measureText(str).width <= room;
    const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    const list = [];
    while (walk.nextNode()) list.push(walk.currentNode);
    list.forEach(t => { t.nodeValue = bindShort(t.nodeValue, fits); });
  }

  function typoPass(refresh) {
    /* ручные переносы и склейка коротких слов — везде, кроме
       просторной десктопной композиции */
    const on = window.innerWidth < 1280 || isLand();
    document.querySelectorAll(TYPO_SEL).forEach(node => {
      if (refresh || !rawText.has(node)) rawText.set(node, node.innerHTML);
      node.innerHTML = rawText.get(node);
      if (on) bindNode(node);
    });
  }

  /* --------- закрывающая сцена на телефоне ---------
     Абсолютные vh-отметки рассчитаны на десктоп: на телефоне блоки
     разной высоты и на коротком экране наезжают друг на друга.
     Расставляем их снизу вверх — подвал, двери, утверждение. */
  function layoutOutro() {
    if (!el.claim || !el.doors || !el.foot) return;
    el.claim.style.top = '';
    el.doors.style.top = '';
    /* и на планшете тоже: там vh-отметки десктопа дают наложение */
    if (window.innerWidth >= 1280 && !isFlat()) return;
    const vh  = viewH();
    const pad = parseFloat(getComputedStyle(el.doors).left) || 20;
    const gap = Math.max(12, Math.round(vh * 0.035));
    const h   = e => e.getBoundingClientRect().height;
    const doorsTop = vh - pad - h(el.foot) - gap - h(el.doors);
    const claimTop = Math.max(pad, doorsTop - gap - h(el.claim));
    if (doorsTop <= claimTop) return;          // не помещается — как было
    el.doors.style.top = Math.round(doorsTop) + 'px';
    el.claim.style.top = Math.round(claimTop) + 'px';
  }

  /* --------- постоянная высота подписи выпуска ---------
     Линия веера считается от низа текстового блока. Пояснения у
     выпусков разной длины (3…5 строк), и веер прыгал при каждом
     переключении. Резервируем место под самое длинное пояснение —
     тогда блок всегда одной высоты, и веер стоит неподвижно. */
  let curItem = null;
  /** Пояснение выпуска: переносы из data.js рассчитаны на широкую
      колонку. На узком экране их нет (white-space:normal), поэтому и
      в тексте заменяем их пробелами — иначе склейка коротких слов
      через такой перенос не работает. */
  function descText(item) {
    return window.innerWidth < 1280
      ? item.desc.replace(/\s*\n\s*/g, ' ')
      : item.desc;
  }
  /* На узком экране (а также на планшете лёжа) под текст выпуска
     резервируем место по самому длинному из двенадцати: иначе линия
     веера прыгала бы при смене номера, а размер фокусной обложки
     подбирался бы по случайно короткому описанию. */
  /* ---------- выпуски ОБОИХ языков ----------
     Высота блока выпуска резервируется по самому длинному описанию.
     Пока она считалась только по текущему языку, раскладка от языка
     зависела: английские описания короче, блок вставал выше, под веер
     оставалось больше высоты — и фокусная обложка выходила крупнее
     русской (на телефонах разница доходила до 17 px, около 7 %).
     Раскладка от языка зависеть не должна, поэтому меряем по самому
     длинному описанию из всех, какие есть на странице. */
  function allIssues() {
    const out = [];
    for (const k in ns.text) {
      const l = ns.text[k] && ns.text[k].issues && ns.text[k].issues();
      if (l) for (let i = 0; i < l.length; i++) out.push(l[i]);
    }
    return out.length ? out : dict().issues();
  }

  function reserveInfo() {
    if (!el.info || !el.title || !el.desc) return;
    el.info.style.minHeight = '';
    if (!isNarrow() && !isLand() && !isFlat()) return;
    const list = allIssues();
    const bind = window.innerWidth < 1280;
    let max = 0;
    for (let i = 0; i < list.length; i++) {
      el.title.textContent = list[i].title;
      el.desc.textContent  = descText(list[i]);
      if (bind) { bindNode(el.title); bindNode(el.desc); }
      max = Math.max(max, el.info.getBoundingClientRect().height);
    }
    el.title.textContent = curItem ? curItem.title : '';
    el.desc.textContent  = curItem ? descText(curItem) : '';
    if (bind) { bindNode(el.title); bindNode(el.desc); }
    el.info.style.minHeight = Math.ceil(max) + 'px';
  }

  /* ---------- телефон лёжа: текст и цепочка делят высоту ----------

     Композиция здесь такая же, как на десктопе: текст выпуска слева,
     цепочка обложек идёт от края до края, фокусный номер крупнее
     колоды и сдвинут правее центра. Разница одна — высоты в пять раз
     меньше, поэтому размеры не берутся из макета, а считаются.

     Фокусная обложка стоит низом на кромке экрана и крупнее колоды
     в FLAT_K раз, поэтому верх цепочки однозначно связан с высотой
     обычной обложки:

       верх_цепочки = vh · (1 + LIFT) − ch · (1 + FLAT_K) / 2

     Отсюда и подбор, в две ступени:

     1. Текст набран штатным кеглем. Считаем, какая высота обложки
        оставляет цепочку НИЖЕ текста, и берём её — но не крупнее
        FLAT_ROW_MAX и не мельче FLAT_ROW_MIN.
     2. Если даже при FLAT_ROW_MIN текст не помещается (маленький
        экран, длинное описание), уменьшаем кегль текста — общим
        множителем --isk, через него заданы все кегли блока в CSS.
        Ниже FLAT_MIN_K не опускаемся: дальше подпись не читается.

     Меряем по САМОМУ ДЛИННОМУ из двенадцати описаний: высота блока
     потом резервируется по нему же (reserveInfo), поэтому зазор
     одинаков на всех выпусках и в обоих языках. */
  const FLAT_ROW_MAX = 0.46;   // доля высоты экрана под обычную обложку
  const FLAT_ROW_MIN = 0.34;
  const FLAT_K       = 1.30;   // во сколько раз фокусная обложка крупнее
  const FLAT_MIN_K   = 0.78;   // предел уменьшения кегля
  let flatRow = 0;             // высота обычной обложки, её ждёт js/issues.js

  /** высота блока выпуска по самому длинному описанию ОБОИХ языков,
      при текущем кегле; возвращает и сам этот выпуск */
  function infoTallest() {
    const list = allIssues();
    const bind = window.innerWidth < 1280;
    const t0 = el.title.textContent, d0 = el.desc.textContent;
    let max = 0, item = list[0];
    for (let i = 0; i < list.length; i++) {
      el.title.textContent = list[i].title;
      el.desc.textContent  = descText(list[i]);
      if (bind) { bindNode(el.title); bindNode(el.desc); }
      const h = el.info.getBoundingClientRect().height;
      if (h > max) { max = h; item = list[i]; }
    }
    el.title.textContent = t0; el.desc.textContent = d0;
    if (bind) { bindNode(el.title); bindNode(el.desc); }
    return { h: max, item: item };
  }

  function fitIssueFlat() {
    flatRow = 0;
    if (!el.info || !el.title || !el.desc) return;
    el.info.style.removeProperty('--isk');
    if (!isFlat()) return;
    const vh = viewH();
    if (!vh) return;
    const gap = vh * 0.045;
    const top = el.info.offsetTop;
    /* высота обложки, при которой цепочка проходит под текстом */
    const rowFor = h => 2 * (vh * (1 + ACT_LIFT) - (top + h) - gap) / (1 + FLAT_K);

    let tall = infoTallest();
    let row = rowFor(tall.h);
    /* текста слишком много — ужимаем кегль, пока цепочка не дорастёт
       до минимального размера */
    if (row < vh * FLAT_ROW_MIN) {
      const t0 = el.title.textContent, d0 = el.desc.textContent;
      const bind = window.innerWidth < 1280;
      el.title.textContent = tall.item.title;
      el.desc.textContent  = descText(tall.item);
      if (bind) { bindNode(el.title); bindNode(el.desc); }
      for (let k = 0.96; k >= FLAT_MIN_K - 0.001; k -= 0.04) {
        el.info.style.setProperty('--isk', k.toFixed(2));
        if (bind) { bindNode(el.title); bindNode(el.desc); }
        row = rowFor(el.info.getBoundingClientRect().height);
        if (row >= vh * FLAT_ROW_MIN) break;
      }
      el.title.textContent = t0; el.desc.textContent = d0;
      if (bind) { bindNode(el.title); bindNode(el.desc); }
    }
    flatRow = clamp(row, vh * FLAT_ROW_MIN, vh * FLAT_ROW_MAX);
  }

  /* ---------- первый экран на вертикальном экране ----------
     Кегли заданы долей ширины, поэтому высота текста зависит от
     экрана. Блоки ставим стопкой сверху вниз с одинаковым просветом,
     а маскоту отдаём всё, что осталось внизу: композиция получается
     одна и та же и на телефоне, и на вертикальном планшете. */
  const CAT_MAX_W = 0.84, CAT_MIN_W = 0.42;   // доли ширины экрана
  /* На макетах маскот занимает 72.9 % ширины на телефоне и 76.4 % на
     вертикальном планшете — растёт вместе с экраном. */
  const catWantW = vw => 0.73 + 0.035 * clamp((vw - 420) / 400, 0, 1);
  /* Нижним краем фигура уходит за экран: на макетах срезано 14 % её
     высоты на телефоне и 25 % на планшете — иначе маскот такого
     размера не встал бы под текст. */
  const CAT_SINK_MAX = 0.26;
  let catSink = 0;                            // насколько фигура опущена, px
  /* --------- первый экран в АЛЬБОМНОЙ ориентации ---------
     Телефон и планшет лёжа. Высоты мало, ширины много: маскот стоит
     в центре, текст — двумя колонками по бокам от него. Раньше блоки
     стояли на фиксированных vh-отметках: на одном экране они липли
     друг к другу, на другом расползались, а кегль был задан в px и
     не зависел от того, сколько места под колонку осталось.

     Теперь всё считается от экрана: сначала маскоту отдаётся высота,
     остаток ширины делится на две колонки, кегль берётся от ШИРИНЫ
     КОЛОНКИ (около 36 знаков в строке) и ужимается, если колонка
     не помещается по высоте. Блоки в колонке стоят стопкой с малым
     просветом и центрируются по вертикали — вокруг маскота. */
  /* Предел ширины маскота, доля экрана. На вытянутом экране (телефон
     лёжа) высоты мало и маскот всё равно упирается в неё, а на
     планшете 4:3 высоты много — там ему нужна бо́льшая доля ширины,
     иначе над головой остаётся пустая полоса. */
  const landCatW = a => 0.36 + 0.07 * clamp((1.9 - a) / 0.5, 0, 1);
  const LAND_CHARS = 16.6;     // ширина колонки на 1 px кегля
  function layoutHeroLand() {
    const lines = el.lines;
    const vw = window.innerWidth, vh = viewH();
    const root = document.documentElement;
    const pad = parseFloat(getComputedStyle(el.brand).paddingLeft) || 20;
    const brandH = parseFloat(getComputedStyle(root).getPropertyValue('--brand-h')) || 72;
    const brandW = parseFloat(getComputedStyle(root).getPropertyValue('--brand-w')) || 150;
    const inset = pad + brandW * 0.1739;    // левый край — по буквам логотипа

    const top0 = pad + brandH + Math.max(6, vh * 0.02);

    /* маскот: ведёт высота, но шире LAND_CAT_W он не растёт —
       иначе колонкам не остаётся места */
    el.cat.style.width = '';
    const ratio = el.cat.offsetWidth ? el.cat.offsetHeight / el.cat.offsetWidth : 1.13;
    const catW = clamp(Math.min(vw * landCatW(vw / vh), (vh - top0 - 6) / ratio),
                       vw * 0.18, vw * 0.46);
    el.cat.style.width = Math.round(catW) + 'px';
    catSink = 0;

    const gut = Math.max(12, vw * 0.025);
    /* колонки симметричны относительно маскота: слева край по буквам
       логотипа, справа — такой же отступ от края экрана */
    const colW = Math.max(130, (vw - catW - 2 * inset - 2 * gut) / 2);

    /* переход стоит внизу справа — под него резервируем место */
    const ctaBot = vh * 0.04;

    let tb = 0, hs = [], gapIn = 0;
    for (let pass = 0; pass < 7; pass++) {
      tb = clamp(colW / LAND_CHARS * (1 - pass * 0.07), 9.5, 19);
      root.style.setProperty('--ltb', tb.toFixed(2) + 'px');
      root.style.setProperty('--lh1', (tb * 1.62).toFixed(2) + 'px');
      lines.forEach(l => { l.style.width = Math.round(colW) + 'px'; });
      hs = lines.map(l => l.offsetHeight);
      gapIn = tb * 1.6;
      const ctaH = el.cta.offsetHeight;
      const left  = hs[0] + gapIn + hs[2];
      const right = hs[1] + gapIn + hs[3];
      if (left <= vh - top0 - pad * 0.5 &&
          right <= vh - top0 - ctaBot - ctaH - gapIn * 0.5) break;
      if (tb <= 9.6) break;
    }

    const ctaH = el.cta.offsetHeight;
    const bandL = vh - top0 - pad * 0.5;
    const bandR = vh - top0 - ctaBot - ctaH - gapIn * 0.5;
    const leftH  = hs[0] + gapIn + hs[2];
    const rightH = hs[1] + gapIn + hs[3];

    let y = top0 + Math.max(0, (bandL - leftH) / 2);
    lines[0].style.top = Math.round(y) + 'px';
    lines[2].style.top = Math.round(y + hs[0] + gapIn) + 'px';
    let r = top0 + Math.max(0, (bandR - rightH) / 2);
    lines[1].style.top = Math.round(r) + 'px';
    lines[3].style.top = Math.round(r + hs[1] + gapIn) + 'px';

    lines[0].style.left = lines[2].style.left = Math.round(inset) + 'px';
    lines[1].style.left = lines[3].style.left = Math.round(vw - inset - colW) + 'px';
    lines.forEach(l => { l.style.right = 'auto'; });
    el.cta.style.top = '';
  }

  function layoutHero() {
    const lines = el.lines;
    if (!lines.length || !el.cta || !el.cat) return;
    if (isLand()) { layoutHeroLand(); return; }
    lines.forEach(l => { l.style.width = ''; l.style.left = ''; l.style.right = ''; });
    document.documentElement.style.removeProperty('--ltb');
    document.documentElement.style.removeProperty('--lh1');
    if (!isNarrow() || isFlat()) {
      lines.forEach(l => { l.style.top = ''; });
      el.cta.style.top = ''; el.cat.style.width = '';
      catSink = 0;
      return;
    }
    const vh = viewH(), vw = window.innerWidth;
    const pad = parseFloat(getComputedStyle(el.brand).paddingLeft) || 20;
    const brandH = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--brand-h')) || 72;

    el.cat.style.width = '';                       // ширина из CSS — верхний предел
    const ratio = el.cat.offsetWidth ? el.cat.offsetHeight / el.cat.offsetWidth : 1.13;
    const wMax = Math.min(el.cat.offsetWidth, vw * CAT_MAX_W);

    const top0 = Math.max(vh * 0.075, pad + brandH + Math.max(14, vh * 0.028));
    const hs = lines.map(l => l.offsetHeight);
    const ctaH = el.cta.offsetHeight;
    const need = hs.reduce((a, b) => a + b, 0);

    /* Просветы РАЗНЫЕ — так на макетах. Внутри смысловой пары блоков
       воздуха мало (1.2 кегля текста), между смысловыми частями —
       заметно больше, а переход отбит от числа сильнее всего.
       Пропорции между просветами сохраняются на любом экране: если
       высоты не хватает, все три сжимаются одним множителем. */
    const tb = parseFloat(getComputedStyle(lines[lines.length - 1]
      .querySelector('.hero__p') || lines[0]).fontSize) || 13;
    const gSect = clamp(vw * 0.039, 26, 34);       // между смысловыми частями
    const want = [gSect, tb * 1.2, gSect, tb * 1.9];
    const wantSum = want.reduce((a, b) => a + b, 0);
    /* сначала место маскоту желаемого размера, воздух — из остатка */
    const catNeed = vw * catWantW(vw) * ratio * (1 - CAT_SINK_MAX);
    const free = vh - top0 - need - catNeed;
    const k = clamp(free / wantSum, 0.42, 1);
    const gaps = want.map(v => v * k);

    let y = top0;
    lines.forEach((l, i) => { l.style.top = Math.round(y) + 'px'; y += hs[i] + gaps[i]; });
    el.cta.style.top = Math.round(y) + 'px';

    /* Маскот начинается на уровне перехода: надпись «Все выпуски»
       стоит справа и ложится на верхний край фигуры — так на обоих
       макетах. Что не помещается по высоте, уходит за нижний край,
       но не больше CAT_SINK_MAX. */
    const catTop = y;
    let w = Math.min(vw * catWantW(vw), wMax);
    let h = w * ratio;
    let sink = h - (vh - catTop);
    if (sink > h * CAT_SINK_MAX) {
      h = (vh - catTop) / (1 - CAT_SINK_MAX);
      w = clamp(h / ratio, vw * CAT_MIN_W, wMax);
      h = w * ratio;
      sink = Math.max(0, h - (vh - catTop));
    }
    catSink = Math.max(0, sink);
    el.cat.style.width = Math.round(w) + 'px';
  }

  function alignBlocks() {
    measureVh();
    typoPass();
    /* Порядок важен: раскладка задаёт ширину колонок и кегли, а цифра
       «12» подгоняется под ТЕКУЩИЙ текст. Поэтому цифру считаем дважды
       — до раскладки (чтобы та мерила блок с цифрой) и после неё,
       уже по окончательной ширине колонки. Раньше был один проход ДО
       раскладки: в альбомной ориентации она меняла кегль и ширину
       колонки уже после подбора, и цифра оставалась от прежних двух
       строк, когда текст переходил на три. */
    /* Рост маскота участвует в расчёте ЕГО ЖЕ размера: в формулу
       входит `catHFix` — высота, замеренная прошлым пересчётом. Пока
       экран не менялся, она верна, но после смены размера первый
       проход считает по старой высоте и попадает мимо. Раньше это
       незаметно исправлялось вторым пересчётом (их на resize приходило
       несколько), а если второго не случалось — маскот так и оставался
       не того размера, и текст наезжал на него. Теперь сходимся здесь
       же: если после прохода рост изменился, повторяем по новому.
       Двух проходов достаточно, дальше значение стоит. */
    for (let pass = 0; pass < 2; pass++) {
      alignCount(); layoutHero(); alignCount();
      const h = el.cat ? el.cat.offsetHeight : 0;
      if (!h || Math.abs(h - catHFix) <= 1) break;
      catHFix = h;
      catWFix = el.cat.offsetWidth || catWFix;
    }
    alignClaim(); fitIssueFlat(); reserveInfo(); layoutOutro();
    /* размер обложек считается от места под текстом выпуска —
       пересчитываем после того, как высота этого текста известна */
    if (issuesRef) {
      /* сколько высоты остаётся под фокусную обложку: от низа
         описания выпуска до нижней кромки экрана */
      if (issuesRef.setFocusLimit) {
        const vh = viewH();
        /* Телефон лёжа и десктоп: текст стоит СЛЕВА, размер обложки
           от него не зависит — предел не нужен. На остальных экранах
           текст стоит сверху, и место под обложку остаётся под ним. */
        issuesRef.setFocusLimit(
          (isNarrow() || isLand()) && !isFlat()
            ? vh - infoLow() - vh * 0.035 : 0);
      }
      /* телефон лёжа: высоту колоды считает fitIssueFlat() */
      if (issuesRef.setRowHeight) issuesRef.setRowHeight(isFlat() ? flatRow : 0);
      issuesRef.measure();
    }
    cacheMetrics();
    measureTracks();
    heroSig = heroShape();      // запомнили, как раскладка выглядит ПОСЛЕ пересчёта
  }
  alignBlocks();
  /* ---------- пересчёт после прихода ресурсов ----------

     Раскладка первого экрана считается по РЕАЛЬНЫМ метрикам: высоте
     логотипа в углу и метрикам шрифта. Если посчитать её раньше, чем
     пришли логотип и шрифт, блоки встанут по запасным размерам, а
     цифра «12» подберётся мельче — и так и останется до первого
     resize или смены языка (именно это и выглядело как баг: в русской
     версии цифра мелкая, после переключения на английский и обратно —
     правильная).

     Поэтому раскладку пересобираем на каждом событии готовности:
     логотип, шрифт (document.fonts.ready + каждое loadingdone, плюс
     явная загрузка нужных начертаний — в Safari ready разрешается
     раньше, чем @font-face из внешней таблицы стилей попадают
     в набор), и на window.load. Вызовы схлопываются в один кадр,
     поэтому лишней работы нет. */
  /* ---------- сторож раскладки ----------

     Размеры текста меняются не только от resize. Позже приходит шрифт
     (в Safari — уже ПОСЛЕ document.fonts.ready), подставляется
     картинка, браузер иначе ломает строку. Причём меняется не только
     высота: склейка коротких слов (bindNode) меряет строку холстом,
     а холст до загрузки шрифта отвечает по запасному, — переносы
     получаются другими.

     Перечислить все события готовности нельзя, поэтому следим за самим
     результатом: запоминаем «подпись» первого экрана (высоты блоков и
     маскота) после каждого пересчёта и сверяем её, когда браузер
     сообщает об изменении размеров. Разошлось — пересобираем.

     От зацикливания две защиты: подпись после нашего же пересчёта
     совпадает (и сторож молчит), а подряд идущих пересборок не больше
     трёх — дальше ждём следующего настоящего изменения. */
  function heroShape() {
    let s = '';
    for (let i = 0; i < el.lines.length; i++) {
      const r = el.lines[i].getBoundingClientRect();
      s += Math.round(r.width) + 'x' + Math.round(r.height) + ',';
    }
    if (el.cat) {
      const c = el.cat.getBoundingClientRect();
      s += Math.round(c.width) + 'x' + Math.round(c.height) + ',';
    }
    /* и сам экран: в режиме отзывчивого дизайна Safari окно меняет
       размер не одним шагом, и пересчёт может успеть пройти по старым
       величинам. Высоту берём у закреплённой сцены — это те самые
       100svh, по которым считается вся геометрия. */
    const pin = el.issuesPin || el.heroPin;
    return s + window.innerWidth + 'x' + (pin ? pin.offsetHeight : 0)
             + '@' + (window.devicePixelRatio || 1);
  }
  function heroGuard() {
    const s = heroShape();
    if (s === heroSig) { heroRuns = 0; return; }
    heroSig = s;
    if (heroRuns++ > 2) return;
    relayout();
  }
  if (window.ResizeObserver) {
    let roRaf = 0;
    const ro = new ResizeObserver(() => {
      if (roRaf) return;
      roRaf = requestAnimationFrame(() => { roRaf = 0; heroGuard(); });
    });
    el.lines.forEach(n => ro.observe(n));
    if (el.cat) ro.observe(el.cat);
    /* сцена меняет высоту вместе с окном — это ловит случай, когда
       текст не переверстался, а экран стал другим */
    if (el.issuesPin) ro.observe(el.issuesPin);
    if (el.heroPin)   ro.observe(el.heroPin);
  }

  /* ---------- окно устаканивается не сразу ----------
     Safari в режиме отзывчивого дизайна подставляет новый экран не
     одним шагом: размер окна, плотность точек и высота сцены приходят
     вразнобой, и пересчёт, сделанный по первому же событию, считает
     по ещё не окончательным величинам. Поэтому после каждого
     изменения размеров несколько раз сверяем: изменилось ли что-то
     с момента последнего пересчёта — и если да, пересобираем.
     Три коротких проверки, дальше тишина. */
  const SETTLE = [180, 600, 1500];
  let settleIds = [];
  function settle() {
    settleIds.forEach(window.clearTimeout);
    settleIds = SETTLE.map(ms => window.setTimeout(() => {
      if (heroShape() !== heroSig) relayout();
    }, ms));
  }
  /* визуальная область — отдельное событие, и в режиме отзывчивого
     дизайна оно приходит даже тогда, когда обычный resize уже был */
  if (window.visualViewport && window.visualViewport.addEventListener) {
    window.visualViewport.addEventListener('resize', () => { relayout(); settle(); });
  }

  let relayoutRaf = 0;
  /* ПОЛНЫЙ пересчёт — ровно тот же набор шагов, что и на resize.
     Важно, что сюда входит measureBrand(): размер логотипа в углу
     считается от ширины окна, а от него зависят и отступ текстовой
     колонки, и предел, до которого ужимается маскот. Раньше здесь
     вызывался только alignBlocks(), поэтому пересчёт, вызванный
     сторожем или шрифтом, считал по СТАРОМУ логотипу: на переходе
     в режим отзывчивого дизайна маскот так и оставался ужатым под
     десктопный логотип, а текст наезжал на него. */
  function relayout() {
    if (relayoutRaf) return;
    relayoutRaf = requestAnimationFrame(() => {
      relayoutRaf = 0;
      measureBrand();
      alignBlocks();
      if (issuesRef) issuesRef.measure();
      update();
    });
  }
  if (document.fonts) {
    if (document.fonts.ready) document.fonts.ready.then(relayout);
    if (document.fonts.addEventListener)
      document.fonts.addEventListener('loadingdone', relayout);
    if (document.fonts.load) {
      ['400 16px Onest', '700 16px Onest', '800 16px Onest']
        .forEach(f => { try { document.fonts.load(f).then(relayout, () => {}); }
                        catch (e) {} });
    }
  }

  /* ---------------------- главный маскот ---------------------- */
  /* дымка по краю силуэта — только там, где браузер грузит CSS-маску
     по URL: при открытии файла с диска маска игнорируется и слой
     превратился бы в прямоугольник поверх маскота */
  if (location.protocol !== 'file:') el.cat.classList.add('has-haze');
  const cat = ns.Mascot.create(el.cat, { meta: ns.heroEyes });

  /* ------------------------ выпуски --------------------------- */
  const issues = ns.Issues.create({
    issues: ns.issues,
    fan: el.fan,
    ticks: el.ticks,
    issueLabel: () => dict().aria.issue,
    coverLabel: () => dict().aria.cover,
    onChange: (item, i) => {
      el.info.classList.add('is-swap');
      /* прежний таймер снимаем: на быстрой прокрутке они копились,
         и более ранний снимал класс, поставленный более поздним —
         а при смене языка успевал записать выпуск из старого словаря */
      window.clearTimeout(swapTimer);
      swapTimer = window.setTimeout(() => {
        curItem = item;
        el.num.textContent = 'NO.' + String(item.n).padStart(2, '0');
        el.title.textContent = item.title;
        el.desc.textContent = descText(item);
        if (window.innerWidth < 1280) { bindNode(el.title); bindNode(el.desc); }
        el.counter.textContent = String(item.n).padStart(2, '0');
        el.info.classList.remove('is-swap');
        /* Высота текстового блока изменилась — на узком экране от неё
           зависит линия веера, поэтому кадр пересчитываем. На телефоне
           ЛЁЖА текст стоит сбоку, линия веера от него не зависит —
           там не читаем раскладку вовсе: этот замер посреди прокрутки
           заставлял браузер пересчитывать её синхронно. */
        if (isNarrow() && !isFlat()) {
          const low = infoLow();
          if (Math.abs(low - infoUsed) > 1) { infoLowFix = low; update(); }
        }
      }, 140);
    },
    onJump: i => jumpToIssue(i)
  });
  actScale = issues.scale;
  issuesRef = issues;
  alignBlocks();                 // размеры колоды знаем только теперь

  function jumpToIssue(i) {
    const t = el.issuesTrack.getBoundingClientRect();
    const top = window.scrollY + t.top;
    const len = el.issuesTrack.offsetHeight - viewH();
    const f = IP0() + (IP[1] - IP0()) * (i / (ns.issues.length - 1));
    window.scrollTo({ top: top + len * f, behavior: 'smooth' });
  }

  /* описание видно всегда — и на десктопе, и на узком экране */

  /* стрелка «Все выпуски серии» ведёт к первому номеру */
  q('#heroCta').addEventListener('click', ev => { ev.preventDefault(); jumpToIssue(0); });

  /* ---------- листание веера пальцем, по горизонтали ----------
     На телефоне рука сама тянется листать номера вбок, а не крутить
     страницу вниз. Оба способа работают одновременно.

     Жест НЕ управляет веером напрямую: он двигает ту же прокрутку, от
     которой веер и так зависит целиком. Поэтому риски, счётчик,
     подмена текста и уход колоды остаются прежней машинерией —
     второго источника правды не появляется, расходиться нечему.

     Включается только на сенсорном экране и только внутри сцены
     выпусков: в первом экране и в закрывающей сцене горизонтальные
     движения не перехватываются вовсе.

     Границы жеста шире, чем «веер стоит на месте»:
     — начало — тот кадр, когда первая обложка ТОЛЬКО ПОЯВИЛАСЬ из-за
       кадра и пошла по дуге. Раньше жест здесь ещё не работал, свайп
       доставался браузеру и читался как прокрутка — веер складывался
       обратно вправо, хотя палец вёл влево;
     — конец — конец ухода колоды. Раньше на двенадцатом номере свайп
       влево упирался в стену, и единственным способом отправить веер
       за кадр оставалась прокрутка вниз. */
  const SW_EDGE  = 28;    // полоса у края экрана: там у браузера жест «назад»
  const SW_LOCK  = 10;    // сколько пройти пальцем, прежде чем выбрать ось
  const SW_RATIO = 1.3;   // насколько движение должно быть горизонтальнее
  const SW_FLING = 0.6;   // вклад броска, в номерах на пиксель в миллисекунду
  const SW_STALE = 90;    // палец замер перед отрывом — броска не было, мс
  /* Сколько пальца приходится на один выпуск. Считаем от МЕНЬШЕЙ стороны
     экрана: ширина у телефона лёжа большая, а рука та же, и ход «на один
     номер» не должен от поворота телефона меняться вдвое. */
  const swSpan = () =>
    clamp(Math.min(window.innerWidth, window.innerHeight) * 0.38, 90, 190);

  /* насколько дальше двенадцатого должен увести палец, чтобы колода
     ушла совсем, а не вернулась на место */
  const SW_AWAY = 0.35;
  /* запас на округление при проверке границ сцены, в долях трека */
  const SW_SLACK = 0.004;
  let swId = null, swX0 = 0, swY0 = 0, swSy = 0, swAxis = 0;
  let swTop = 0, swLen = 0, swK = 0, swVx = 0, swLastX = 0, swLastT = 0;
  let swLo = 0, swHi = 0;
  /* Слушатель движения пальца обязан быть НЕпассивным — только такой
     может отменить прокрутку браузера. Но непассивный слушатель на окне
     заставляет браузер на КАЖДОМ касании ждать основной поток, прежде
     чем начать прокрутку, а он у нас занят кадром сцены: обычная
     вертикальная прокрутка начиналась бы с задержкой. Поэтому вешаем
     его только на время жеста — с момента касания внутри сцены веера
     и до отрыва пальца. */
  let swBound = false;
  function swBind(on) {
    if (on === swBound) return;
    swBound = on;
    if (on) window.addEventListener('touchmove', swMove, { passive: false });
    else    window.removeEventListener('touchmove', swMove);
  }
  const swOff = () => { swId = null; swAxis = 0; swBind(false); };

  function swDown(ev) {
    swOff();
    if (!issuesRef || !ev.touches || ev.touches.length !== 1) return;
    const t = ev.touches[0];
    if (t.clientX < SW_EDGE || t.clientX > window.innerWidth - SW_EDGE) return;
    const vh = viewH();
    const ip = progressAt('issues', vh, window.scrollY);
    /* Жест живёт ровно между теми же двумя точками, что и ход пальца
       ниже: от кадра, с которого дуга уносит маскота, до конца ухода
       колоды. Начинать можно и там, куда жест сам же и привёл, —
       иначе, отмотав веер назад пальцем, вернуть его пальцем было бы
       уже нельзя. */
    /* допуск: доводка жеста приходит ровно на границу, и округление
       прокрутки до целого пикселя иначе отрезало бы обратный ход */
    if (ip < tr().carry[0] - SW_SLACK || ip > DEPART[1] + SW_SLACK) return;
    const g = geo.issues;
    swLen = g[1] - vh;
    if (swLen <= 0) return;
    swTop = g[0];
    /* прокрутка, приходящаяся на один выпуск, делённая на ход пальца */
    swK = (swLen * (IP[1] - IP0()) / (ns.issues.length - 1)) / swSpan();
    /* Пределы хода пальцем — ровно те же две точки, между которыми
       живёт веер: позади — кадр, с которого дуга начинает уносить
       маскота (там веера ещё нет и фигура видна целиком), впереди —
       конец ухода колоды. Так и вперёд, и назад веер уходит пальцем
       так же, как прокруткой. */
    swLo = swTop + swLen * tr().carry[0];
    swHi = swTop + swLen * DEPART[1];
    swId  = t.identifier;
    swX0  = swLastX = t.clientX;
    swY0  = t.clientY;
    swSy  = window.scrollY;
    swVx  = 0;
    swLastT = performance.now();
    swBind(true);
  }

  function swMove(ev) {
    if (swId === null) return;
    let t = null;
    for (let i = 0; i < ev.touches.length; i++)
      if (ev.touches[i].identifier === swId) { t = ev.touches[i]; break; }
    if (!t) return;
    const dx = t.clientX - swX0, dy = t.clientY - swY0;
    if (!swAxis) {
      /* ось выбирается ОДИН раз за жест и дальше не пересматривается:
         иначе диагональное движение дёргало бы страницу в обе стороны */
      if (Math.abs(dx) < SW_LOCK && Math.abs(dy) < SW_LOCK) return;
      swAxis = Math.abs(dx) > Math.abs(dy) * SW_RATIO ? 1 : -1;
      if (swAxis < 0) { swOff(); return; }        // вертикаль — браузеру
    }
    ev.preventDefault();
    const now = performance.now(), dt = now - swLastT;
    if (dt > 0) swVx = (t.clientX - swLastX) / dt;
    swLastX = t.clientX; swLastT = now;
    window.scrollTo(0, Math.round(clamp(swSy - dx * swK, swLo, swHi)));
  }

  function swUp() {
    if (swId === null || swAxis !== 1) { swOff(); return; }
    swOff();
    const n = ns.issues.length - 1;
    const ip = progressAt('issues', viewH(), window.scrollY);
    const at = (ip - IP0()) / (IP[1] - IP0()) * n;
    const fling = (performance.now() - swLastT > SW_STALE)
      ? 0 : clamp(-swVx * SW_FLING, -2, 2);
    const to = at + fling;
    /* Увели дальше крайнего номера — доводим веер до конца, ровно
       туда же, куда его уводит прокрутка. Вперёд (за двенадцатым) —
       колода уходит за кадр; назад (перед первым) — дуга отматывается
       обратно, и на экране снова маскот. Без этого доводка возвращала
       бы веер на крайний номер, и уйти пальцем было бы нельзя. */
    /* Куда вёл палец. Без этого жест, начатый уже ЗА крайним номером
       и ведущий обратно к вееру, доводился бы туда же, откуда начат:
       он ведь всё ещё «за краем». */
    const вспять = swLastX > swX0;
    if (!вспять && to >  n + SW_AWAY) return swAway(DEPART[1]);
    if ( вспять && to < -SW_AWAY)     return swAway(tr().carry[0]);
    jumpToIssue(Math.round(clamp(to, 0, n)));
  }
  /** довести прокрутку до заданной доли трека выпусков */
  function swAway(frac) {
    window.scrollTo({ top: Math.round(swTop + swLen * frac), behavior: 'smooth' });
  }

  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    window.addEventListener('touchstart',  swDown, { passive: true });
    window.addEventListener('touchend',    swUp,   { passive: true });
    window.addEventListener('touchcancel', swOff,  { passive: true });
  }

  /* --------------------- смена языка --------------------------
     Меняем только содержимое узлов — сами узлы остаются теми же,
     поэтому ссылки на них (выравнивание «12», строки веера)
     продолжают работать, а раскладка не пересобирается.        */
  const T = {
    h1:   q('.hero__h1'),
    h3:   q('.hero__h3'),
    softP:q('.hero__line--soft .hero__p'),
    h2:   q('.hero__h2'),
    midP: q('.hero__line--mid .hero__p'),
    cnt:  q('.hero__count-txt'),
    numP: q('.hero__line--num .hero__p'),
    cta:  q('.hero__cta-text'),
    hint: q('#heroHint span'),
    railK:   Array.from(document.querySelectorAll('.rail__k')),
    railTag: Array.from(document.querySelectorAll('.rail__tag')),
    claimHead: q('.claim__head'),
    claimNote: q('.claim__note'),
    doorRuLang: q('#doorRu .door__lang'), doorRuGo: q('#doorRu .door__go'),
    doorEnLang: q('#doorEn .door__lang'), doorEnGo: q('#doorEn .door__go'),
    doorRu: q('#doorRu'), doorEn: q('#doorEn'), beam: q('.door__beam')
  };

  function applyLang(name) {
    lang = ns.text[name] ? name : 'ru';
    const d = dict(), en = lang === 'en';
    document.documentElement.lang = d.code;
    document.title = d.meta.title;
    const md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', d.meta.desc);

    T.h1.innerHTML    = d.hero.h1;
    T.h3.innerHTML    = d.hero.h3;
    T.softP.innerHTML = d.hero.softP;
    T.h2.innerHTML    = d.hero.h2;
    T.midP.innerHTML  = d.hero.midP;
    T.cnt.innerHTML   = d.hero.countTxt;
    T.numP.innerHTML  = d.hero.numP;
    T.cta.textContent = d.cta;
    T.hint.textContent = d.hint;

    d.rail.forEach((r, i) => {
      if (T.railK[i])   T.railK[i].textContent = r.k;
      if (T.railTag[i]) T.railTag[i].textContent = r.tag;
    });
    /* точка в конце утверждения — акцентная, поэтому отдельным узлом */
    T.claimHead.innerHTML = d.claim.head + '<span class="claim__dot">.</span>';
    T.claimNote.innerHTML = d.claim.note;   // в тексте заданы переносы строк
    typoPass(true);                          // склейки пересчитываем по новому тексту
    reserveInfo();   // подбор кегля и размера колоды идёт ниже, в alignBlocks()

    T.doorRuLang.textContent = d.doors.ru.lang;
    T.doorRuGo.textContent   = d.doors.ru.go;
    T.doorEnLang.textContent = d.doors.en.lang;
    T.doorEnGo.textContent   = d.doors.en.go;

    /* бегущий блик подсвечивает ту площадку, где лежит версия серии
       на языке страницы: Boosty для русской, Patreon для английской */
    const lit = en ? T.doorEn : T.doorRu, dim = en ? T.doorRu : T.doorEn;
    lit.classList.add('door--pulse');
    dim.classList.remove('door--pulse');
    if (T.beam && T.beam.parentElement !== lit) lit.appendChild(T.beam);

    /* подписи переключателей: в английской версии они тоже должны
       быть английскими, а у языка подпись называет, КУДА переключит */
    if (langBtn)  langBtn.setAttribute('aria-label', d.aria.lang);
    if (themeBtn) themeBtn.setAttribute('aria-label', d.aria.theme);

    issues.setData(d.issues());
    alignBlocks();

    langIcon.src = 'assets/ui/lang-' + (en ? 'en' : 'ru') + '.png';
    if (langBtn) langBtn.setAttribute('aria-pressed', String(en));
    update();
  }

  /* по умолчанию — русская версия, дальше тоже запоминается */
  let saved = 'ru';
  try { saved = localStorage.getItem(LANG_KEY) || 'ru'; } catch (e) {}
  applyLang(saved);

  if (langBtn) langBtn.addEventListener('click', () => {
    applyLang(lang === 'en' ? 'ru' : 'en');
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  });

  /* ------------------------- ссылки --------------------------- */
  q('#doorRu').href = ns.links.boosty;
  q('#doorEn').href = ns.links.patreon;
  document.querySelectorAll('.door').forEach(a => {
    a.target = '_blank'; a.rel = 'noopener';
  });

  /* ---------------------- курсорная точка --------------------- */
  window.addEventListener('pointermove', ev => {
    document.body.classList.add('has-pointer');
    el.dot.style.left = ev.clientX + 'px';
    el.dot.style.top = ev.clientY + 'px';
  }, { passive: true });


  /* --------------------------- цикл --------------------------- */
  /* ------------------ цикл кадров прокрутки ------------------
     Событие scroll браузер на телефоне склеивает: несколько кадров
     прокрутки могут прийти одним событием, и сцена на этих кадрах
     стоит на месте, а потом прыгает — это и читалось как «фриз».
     Поэтому на время прокрутки крутим свой цикл и каждый кадр берём
     window.scrollY сами; когда прокрутка остановилась, цикл гаснет. */
  let raf = 0, idleFrames = 0, lastSy = -1;
  const IDLE_STOP = 8;          // сколько спокойных кадров дорисовать
  function tick() {
    const sy = window.scrollY;
    if (sy === lastSy) {
      if (++idleFrames > IDLE_STOP) { raf = 0; return; }
    } else { idleFrames = 0; lastSy = sy; }
    update();
    raf = requestAnimationFrame(tick);
  }
  function onScroll() { if (!raf) { idleFrames = 0; raf = requestAnimationFrame(tick); } }


  function update() {
    const vh = viewH();

    /* Все измерения раскладки — здесь, ДО единой записи стилей ниже.
       Так браузер считает раскладку один раз за кадр. */
    const sy = window.scrollY;
    const hp = progressAt('hero', vh, sy);
    const ip = progressAt('issues', vh, sy);

    /* ---------------- логотип ---------------- */
    /* t = 0 — знак в центре экрана, t = 1 — в углу, где он и стоит
       по раскладке: в конце трансформация обнуляется. Путь и масштаб
       те же, что и прежде. */
    const t = ease(span(hp, PH.logoOut));
    const k = 1 - t;
    css(brandImg, 'transform',
      'translate(' + (cx * k).toFixed(1) + 'px,' + (cy * k).toFixed(1) + 'px) ' +
      'scale(' + (1 - (1 - bs) * t).toFixed(4) + ')');

    /* ------------- передача сцены S3 → S4 -------------
       fanIn : веер выходит из-под воротника, маскот чуть поднимается
       carry : дуга доворачивается против часовой и уносит маскота
       back  : веер возвращается по дуге — уже с заголовком выпуска  */
    const T = tr();
    const fanIn = ease(span(ip, T.fanIn));
    const liftE = ease(span(ip, T.lift));
    const carry = span(ip, T.carry);
    const backL = span(ip, T.back);
    const back  = ease(backL);

    /* общая кромка «веер + кот»: от опоры маскота до рабочей линии */
    const catH0 = catHFix || vh * 0.7;
    /* На вертикальном экране фигура опущена: нижним краем она уходит
       за экран (layoutHero, catSink). Колода стоит у её опоры, поэтому
       её рабочая линия опускается на столько же — иначе веер выезжал
       бы не из-под воротника, а над ним. */
    const topLow  = clamp01(1 - CAT_SINK * catH0 / vh + catSink / vh);
    /* К концу подъёма кромка колоды приходит РОВНО на рабочую линию
       сцены выпусков. На десктопе это почти совпадало и так, а на
       телефоне кот мелкий, колода останавливалась много ниже — и
       веер выпусков потом возникал скачком, без связи с предыдущим
       кадром. Теперь конец одной сцены и начало другой — одна точка. */
    /* Куда поднимается связка «кот + лента».

       На вертикальном экране — НЕ до рабочей линии сцены выпусков:
       там она уезжала под самый логотип, обложки отрывались от
       маскота и повисали в середине экрана. Поднимаем ровно
       настолько, чтобы НИЗ обложек встал на нижнюю кромку экрана —
       так на макете. Ленте это и нужно: она уходит влево целиком,
       а сцена выпусков возвращает веер уже своей дугой. */
    const narrowNow = isNarrow() && !isFlat();
    const topRest = (narrowNow && fanChFix)
      ? clamp(1 - fanChFix / vh, 0.35, topLow)
      : topNorm();
    let topShared = topLow - (topLow - topRest) * liftE;
    /* Телефон лёжа: высоты мало, и связка «маскот + колода» уезжала
       так высоко, что голова уходила за верх экрана и под логотип.
       Выше этой линии колоду не поднимаем — маскот при этом остаётся
       целым и прежнего размера. */
    if (isFlat()) {
      const need = (limitFix + catH0 * 0.72) / vh;
      topShared = Math.max(topShared, Math.min(need, topLow));
    }

    let spin, topFrac, pos, showActive;
    /* Длина проезда ленты: на вертикальном экране мимо маскота
       проходят все двенадцать обложек, на десктопе — прежние 38°.
       Разгон мягкий, но не квадратичный: на длинном проезде квадрат
       давал стоячее начало и рывок в конце. */
    const spinEnd = narrowNow ? stripSpin() : SPIN;
    if (ip < T.back[0]) {
      spin = -spinEnd * carry * (0.55 + 0.45 * carry);
      /* сначала колода выезжает снизу к маскоту, потом идёт вверх вместе с ним */
      topFrac = ip < T.fanIn[1]
        ? TOP_ENTER + (topLow - TOP_ENTER) * fanIn
        : topShared;
      pos = 0; showActive = false;        // раскладку задаёт renderStrip
    } else if (ip < IP0()) {
      spin = RET * (1 - backL);                     // равномерный вход из-за кадра
      topFrac = topNorm(); pos = 0; showActive = true;
    } else {
      topFrac = topNorm();
      pos = span(ip, [IP0(), IP[1]]) * (ns.issues.length - 1);
      showActive = true;
      spin = -SPIN * ease(span(ip, DEPART));   // двенадцатый уходит той же дугой
    }
    if (ip < T.back[0]) issues.renderStrip(spin, topFrac);
    else issues.render(pos, spin, topFrac, showActive);


    /* Веер не проявляется — он выезжает снизу. Гаснет только ХВОСТ
       проезда: к этому моменту двенадцатая обложка уже прошла мимо
       маскота и уходит за левый край, дальше в ленте идут только
       повторы. Раньше гасло с 40 % проезда — лента обрывалась на
       девятом номере. Маскот при этом давно ушёл влево вместе с ней. */
    let fanOp = 1;
    if ((isNarrow() || isFlat()) && ip > T.carry[0] && ip < T.back[0]) {
      const k = narrowNow ? 0.80 : 0.40;
      const from = T.carry[0] + (T.carry[1] - T.carry[0]) * k;
      fanOp = 1 - ease(span(ip, [from, T.back[0]]));
    }
    css(el.fan, 'opacity', fanOp.toFixed(3));

    /* ---------------- главный маскот ----------------
       поднимается, дорастает до размера ДО появления текста,
       затем стоит на веере и уезжает вместе с ним по дуге */
    const rise = ease(span(hp, PH.rise));
    const catH = catHFix || vh * 0.7;
    const riseScale = 0.88 + 0.12 * rise;

    /* кот стоит на своей линии, пока веер только выезжает снизу;
       поднимается вместе с ним и той же дугой уходит за кадр */
    const catSpin = ip < T.carry[1] ? spin : -spinEnd;
    const a = issues.arcPoint(0, catSpin, topShared);
    const gone = ip >= T.back[0];      // к этому моменту кот уже вне кадра
    const dx = a.cx - window.innerWidth / 2;
    const dy = (a.cy - a.ch / 2) - topLow * vh;
    const baseArc = (12 - 12 * rise) / 100 * catH + dy + catSink * rise;

    /* Маскот не должен заезжать под логотип. Пока он стоит внизу,
       места хватает; когда веер поднимает его вверх, фигура мягко
       уменьшается ровно настолько, чтобы макушка осталась под
       логотипом. Низ фигуры при этом не сдвигается — она садится
       на ту же дугу, что и колода. */
    const limit = limitFix;
    const visBottom = vh + baseArc + catH * (riseScale - 1) / 2;
    const fit = softClamp(catH > 0 ? (visBottom - limit) / (riseScale * catH) : 1,
                          CAT_FIT_MIN, 1, SOFT_K);
    const scale = riseScale * fit;
    /* Фигура закреплена относительно окна (см. .hero__cat в CSS), так
       что смещение залипающего блока вычитать больше не нужно —
       и расходиться с композитором нечему. */
    const baseY = baseArc + catH * riseScale * (1 - fit) / 2;

    /* Маскот стоит ЗА колодой: если гасить только её, он начинает
       просвечивать сквозь обложки. Гаснут вместе. */
    css(el.cat, 'opacity', (gone ? 0 : rise * fanOp).toFixed(3));
    css(el.cat, 'transform',
      /* только пиксели: проценты браузер каждый кадр разрешал бы
         относительно раскладки фигуры */
      'translate(' + (dx - catWFix / 2).toFixed(1) + 'px,' +
      (baseY - catHFix).toFixed(1) + 'px) ' +
      'rotate(' + a.ang.toFixed(2) + 'deg) ' +
      'scale(' + scale.toFixed(4) + ')');
    cat.setLook(rise * (1 - clamp01(ip / tr().fanIn[1])));
    /* на перелёте выключаем дымку: слой с маской во весь силуэт */
    cls(el.cat, 'is-flight', ip >= T.carry[0]);

    /* ---------------- текст вокруг маскота ----------------
       появляется снизу вверх по очереди, уходит вниз на fanIn */
    const rev = span(hp, PH.reveal);
    let lastOut = 0;
    el.lines.forEach((line, i) => {
      const from = i * 0.20, to = from + 0.30;
      const p = ease(clamp01((rev - from) / (to - from)));
      /* уходят в том же порядке, в каком пришли, — по одному и быстро */
      const o0 = PH.textOut[0] + i * OUT_STEP;
      const out = ease(clamp01((hp - o0) / OUT_SPAN));
      lastOut = out;
      css(line, 'opacity', (p * (1 - out)).toFixed(3));
      css(line, 'transform',
        'translateY(' + (34 * (1 - p) - 26 * out).toFixed(1) + 'px)');
      /* курсор ловит только полностью проявленный блок */
      css(line, 'pointerEvents', (p > 0.9 && out < 0.1) ? 'auto' : 'none');
    });

    css(el.hint, 'opacity', (1 - ease(clamp01(hp / 0.08))).toFixed(3));

    /* переход к выпускам: появляется после текста, уходит вместе с ним */
    const ctaIn = ease(span(hp, PH.cta));
    css(el.cta, 'opacity', (ctaIn * (1 - lastOut)).toFixed(3));
    css(el.cta, 'transform',
      'translateY(' + ((1 - ctaIn) * 24 - lastOut * 26).toFixed(1) + 'px)');

    /* заголовок появляется вместе с возвратом веера и гаснет,
       когда последний номер уже ушёл в левый нижний угол */
    const textOff = ease(span(ip, TEXT_OFF));
    const infoOp = (back * (1 - textOff)).toFixed(3);
    css(el.info, 'opacity', infoOp);
    css(el.head, 'opacity', infoOp);
    css(el.issuesPin, 'opacity', (1 - ease(span(ip, PIN_OFF))).toFixed(3));

    /* ---------------- закрывающая сцена ---------------- */
    const op = progressAt('outro', vh, sy);
    /* полка со статистикой въезжает вместе с самой сценой:
       она поднимается снизу и встаёт под логотипом, без чёрной паузы */
    /* въезд считаем от того же замера трека, что и прогресс:
       лишний getBoundingClientRect в кадре заставлял браузер
       пересчитывать раскладку синхронно */
    const slide = clamp01((vh - (geo.outro[0] - sy)) / vh);
    const railIn  = ease(span(slide, ou().railIn));
    const railOut = ease(span(op, ou().railOut));
    const claimIn = ease(span(op, ou().claim));
    const doorsIn = ease(span(op, ou().doors));
    const footIn  = ease(span(op, ou().foot));

    /* Бесконечные анимации (подсказка, наконечник перехода, блик и
       стрелки дверей) крутятся только тогда, когда их сцена на экране.
       Вне её браузер каждый кадр пересчитывал их стиль впустую —
       см. раздел в css/styles.css. */
    cls(el.heroPin, 'sc-on', hp < 0.86);
    cls(el.doors,   'sc-on', doorsIn > 0.01);

    layer(el.rail,  railIn * (1 - railOut), -railOut * 22);
    layer(el.claim, claimIn, (1 - claimIn) * 60);
    layer(el.doors, doorsIn, (1 - doorsIn) * 76);
    layer(el.foot,  footIn,  (1 - footIn) * 30);
  }

  /** слой закрывающей сцены: прозрачность и подъём снизу */
  function layer(node, o, dy) {
    css(node, 'opacity', o.toFixed(3));
    css(node, 'transform', 'translateY(' + dy.toFixed(1) + 'px)');
  }

  /* объявлены функциями, а не константами: applyLang вызывает update()
     ещё до конца модуля, и стрелочные const были бы недоступны */
  /** нижняя граница логотипа плюс зазор — выше неё маскот не поднимается */
  function logoLimit() {
    const cs = getComputedStyle(el.brand);
    const pad = parseFloat(cs.paddingTop) || 32;
    const h = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--brand-h')) || 72;
    return pad + h + pad * CAT_GAP;
  }

  /* ---------- запись стиля только при изменении ----------
     Каждая запись в style помечает узел грязным, и браузер заново
     считает для него (и его псевдоэлементов) каскад. В кадре прокрутки
     таких записей набиралось под полсотни, причём большая часть ставила
     то же самое значение, что и в прошлом кадре: прозрачность единица,
     pointer-events none, z-index тот же. Пересчёт стилей был самой
     дорогой строкой в профиле — дороже и скрипта, и раскладки.
     Теперь рядом с узлом лежит последнее записанное значение, и
     запись происходит, только когда значение действительно поменялось. */
  function css(node, prop, val) {
    const c = node.__css || (node.__css = {});
    if (c[prop] === val) return;
    c[prop] = val;
    node.style[prop] = val;
  }
  /** класс переключаем так же — только на смене состояния */
  function cls(node, name, on) {
    const c = node.__cls || (node.__cls = {});
    if (c[name] === on) return;
    c[name] = on;
    node.classList.toggle(name, on);
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function span(p, r) { return clamp01((p - r[0]) / (r[1] - r[0])); }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  window.addEventListener('scroll', onScroll, { passive: true });
  /* На телефоне resize прилетает и тогда, когда браузер просто убрал
     адресную строку. Настоящий размер сцены при этом не меняется —
     пересобирать раскладку посреди прокрутки не нужно и вредно: это
     как раз и выглядело как рывок. */
  let lastW = 0, lastH = 0;
  window.addEventListener('resize', () => {
    measureVh();
    /* даже если размер сцены не изменился (телефон просто спрятал
       адресную строку), запускаем отложенную сверку: в режиме
       отзывчивого дизайна окончательные величины приходят позже */
    settle();
    if (window.innerWidth === lastW && vhFix === lastH) return;
    lastW = window.innerWidth; lastH = vhFix;
    measureBrand(); alignBlocks(); issues.measure(); update();
  });
  window.addEventListener('load', () => {
    lastW = window.innerWidth; lastH = measureVh();
    /* к этому моменту пришли и картинки, и шрифт: считаем раскладку
       начисто, иначе на странице остаются размеры, подобранные по
       запасным метрикам */
    measureBrand(); alignBlocks(); issues.measure();
    cacheMetrics(); measureTracks(); update();
  });
  update();
})(window.CATALYST = window.CATALYST || {});
