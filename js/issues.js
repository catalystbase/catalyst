/* =========================================================
   S4 — «Веер»: 12 обложек лежат перекрывающейся дугой.

   Согласованные правила (claude/concept.md, claude/s4-mascots.md):
   • все 12 карт на экране одновременно;
   • активная карта ВСЕГДА в центре — под ней проезжает колода;
   • угловой шаг сжимается к краям (tanh), поэтому крайние выпуски
     не уезжают за границу экрана;
   • сверху — номер и название крупно, краткое содержание — колонкой справа;
   • маскоты выпусков в этой сцене не выводятся (решение 27.08):
     образ кота уже присутствует на каждой обложке.
   ========================================================= */
(function (ns) {
  'use strict';

  /* Дуга: ang = A · tanh(d / K). Колода едет под неподвижным фокусом:
     положение карты считается от её расстояния до фокуса (d = i − pos),
     угловой шаг сжимается к краям, поэтому крайние выпуски не уезжают
     за границу экрана, а хвосты уходят за оба края окна. */
  const A = 15.5;    // максимальное отклонение карты по дуге, градусы
  const K = 3.1;     // жёсткость сжатия дуги к краям
  /* Высоту берём у закреплённого блока сцены (в CSS он 100svh и не
     меняется), а не у окна: на телефоне window.innerHeight растёт
     во время прокрутки вниз, когда прячется адресная строка, и режим
     мог переключиться прямо посреди движения. */
  let vhPin = 0;
  const viewH = () => vhPin || window.innerHeight;
  /* Признак режима берём по той же высоте, что и медиазапросы CSS
     (js/main.js, viewCss): у веера и у стилей должен быть один и тот
     же ответ на вопрос «это телефон лёжа?». Геометрия ниже считается
     по закреплённому блоку сцены. */
  const viewMode = () => (ns.viewCss ? ns.viewCss() : viewH());
  const flat = () => viewMode() <= 560 && window.innerWidth > viewMode();
  const arcA = () => A;
  const arcK = () => K;
  /* Экран, где веер встаёт НА нижнюю кромку, а фокусная обложка
     задаётся не множителем к колоде, а местом на экране: вертикальный
     телефон и планшет, а также планшет ЛЁЖА. Признак тот же, что
     у альбомной раскладки первого экрана (isLand в js/main.js):
     горизонтальный экран уже 1280 px ИЛИ широкий, но не вытянутый
     (планшет 4:3 — 1366×1024). Телефона лёжа это не касается: там
     текст слева, веер справа и своя линия. */
  const TALL_MQ = '(max-width: 900px), (max-width: 1279px) and (orientation: portrait)';
  const LAND_RATIO = 1.45;
  const landish = () => {
    const w = window.innerWidth, h = viewMode();
    return !!h && w > h && (w < 1280 || w / h < LAND_RATIO);
  };
  const tallMQ = window.matchMedia(TALL_MQ);   // живой список, создаём один раз
  const tall = () => !flat() && (tallMQ.matches || landish());
  /* Десктоп — просторная композиция: крупная обложка сдвинута вправо,
     ряд сомкнут. Только на настоящем десктопе. */
  const desk = () => window.innerWidth >= 1280 && !flat() && !tall();
  /* Предел по ШИРИНЕ: на телефоне обложка занимает 80 % ширины экрана
     (снято со скриншота-макета), на планшете доля меньше — иначе она
     заняла бы его целиком. Второй предел — по свободной ВЫСОТЕ под
     текстом выпуска, его сообщает main.js (setFocusLimit). Берём
     меньшее из двух: обложка вырастает ровно настолько, насколько
     позволяет экран. */
  const FOCUS_NEAR = 0.78, FOCUS_FAR = 0.62;
  const focusFrac = w =>
    FOCUS_NEAR + (FOCUS_FAR - FOCUS_NEAR) * clamp((w - 430) / 594, 0, 1);
  /* Фокусную обложку выделяем размером. На узком экране подъёма и
     снятой вуали мало — обложки мелкие. На десктопе места больше
     всего: там фокусная обложка — главный герой сцены, она крупнее
     колоды, поднята выше и стоит правее центра. Сама колода и
     передача фокуса от этого не меняются: размер, подъём и сдвиг
     получает только та карта, что сейчас в фокусе. */
  const ACT_FLAT = 1.30;             // телефон лёжа: композиция та же, множитель скромнее
  const ACT_SCALE_WANT = () =>
    flat() ? ACT_FLAT : window.innerWidth <= 900 ? 1.16 : desk() ? 1.40 : 1;
  const ACT_DX    = 0.13;            // сдвиг фокусной обложки вправо, доля ширины
  const ACT_BOT   = 0;               // запас под нижним краем обложки, доля высоты
  const COVER_RATIO = 8000 / 5656;   // пропорции обложек
  /* подъём активной карты, доля высоты сцены */
  const LIFT = 0.12, LIFT_DESK = 0.19;
  const liftK = () => (desk() ? LIFT_DESK : LIFT);

  const OVERLAP = 0.24;              // насколько соседние обложки находят друг на друга
  const CAT_I = 5;                   // позиция маскота в этой ленте
  const ECHO = 9;                    // добавочные карты, чтобы лента не обрывалась

  function create(opts) {
    let data     = opts.issues;
    const fan    = opts.fan;
    const pin    = fan.parentElement;
    const ticks  = opts.ticks;

    const cards = data.map((item, i) => {
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.index = i;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', 'Выпуск ' + pad(item.n) + ' — ' + item.title);
      const img = new Image();
      img.src = item.cover;
      img.alt = 'Обложка выпуска ' + pad(item.n) + ': ' + item.title;
      img.loading = i < 4 ? 'eager' : 'lazy';
      el.appendChild(img);
      fan.appendChild(el);
      return el;
    });

    /* добавочные карты: нужны только на перелёте, чтобы лента
       уходила за оба края экрана и нигде не обрывалась */
    const echo = [];
    for (let i = 0; i < ECHO; i++) {
      const el = document.createElement('div');
      el.className = 'card card--echo';
      el.setAttribute('aria-hidden', 'true');
      const img = new Image();
      img.src = data[i % data.length].cover;
      img.alt = '';
      img.loading = 'lazy';
      el.appendChild(img);
      fan.appendChild(el);
      echo.push(el);
    }
    const strip = cards.concat(echo);


    const tickEls = data.map((item, i) => {
      const b = document.createElement('button');
      b.className = 'tick';
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', 'false');
      b.setAttribute('aria-controls', 'issueInfo');
      b.setAttribute('aria-label', 'Выпуск ' + pad(item.n));
      b.addEventListener('click', () => opts.onJump(i));
      ticks.appendChild(b);
      return b;
    });

    cards.forEach(el => {
      const go = () => opts.onJump(+el.dataset.index);
      el.addEventListener('click', go);
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    });

    let active = -1;
    let W = 0, H = 0, cw = 0, ch = 0, R = 0, step = 5;
    /* Бокс карты равен САМОМУ КРУПНОМУ её размеру (фокусному), а все
       трансформации только уменьшают. Браузер растрирует слой один раз
       по боксу, поэтому увеличенная обложка не размывается: её пиксели
       уже посчитаны на нужный размер. */
    let CW = 0, CH = 0;
    /* фактический множитель фокусной обложки (CW / cw) и предел
       по свободной высоте под текстом выпуска — его сообщает main.js */
    let SC = 1, focusLimit = 0;
    function setFocusLimit(px) { focusLimit = px > 0 ? px : 0; }
    /* Телефон лёжа: высоту обычной обложки задаёт main.js — она
       считается от высоты текста выпуска, чтобы цепочка прошла под
       ним (см. fitIssueFlat). Ноль — считаем по своей формуле. */
    let rowH = 0;
    function setRowHeight(px) { rowH = px > 0 ? px : 0; }

    function measure() {
      const r = pin.getBoundingClientRect();
      W = r.width; H = r.height;
      vhPin = pin.offsetHeight || H;
      /* На узком экране обложек помещается меньше, зато их можно
         показать крупнее — иначе фокусный номер не читается.
         На низком экране (телефон лёжа) размер ограничен высотой. */
      if (flat() && rowH > 0) {
        cw = clamp(rowH / COVER_RATIO, 84, 345);
      } else {
        cw = W <= 900 ? clamp(W * (W <= 620 ? 0.54 : 0.34), 126, 345)
                      : clamp(W * 0.2063, 126, 345);
        if (H < 620) cw = clamp(Math.min(cw, H * 0.46 / COVER_RATIO), 84, 345);
      }
      ch = cw * COVER_RATIO;
      R = W * 1.875;
      /* шаг ленты считаем от размера обложки: хорда между соседними
         картами короче их ширины ровно на OVERLAP, поэтому нахлёст
         одинаков на любой ширине экрана и просветов нигде нет */
      step = 2 * Math.asin(clamp(cw * (1 - OVERLAP) / (2 * R), 0, 1)) * 180 / Math.PI;
      /* Размер фокусной обложки.

         На вертикальном телефоне он задан не множителем к колоде,
         а долей ШИРИНЫ экрана — так на скриншоте-макете. Сверху его
         ограничивает свободная высота под текстом выпуска
         (setFocusLimit): на низком экране обложка такого размера
         просто не помещается, и там она остаётся размером с колоду. */
      CW = cw * ACT_SCALE_WANT();
      if (tall()) {
        let want = W * focusFrac(W);
        if (focusLimit > 0) want = Math.min(want, focusLimit / COVER_RATIO);
        /* на низком экране места нет — там остаётся прежний множитель,
           иначе фокусная обложка сравнялась бы с колодой */
        CW = Math.max(CW, want);
      }
      SC = CW / cw;
      CH = CW * COVER_RATIO;
      fitSqueeze();
      fitPush();
      fan.style.setProperty('--cw', cw + 'px');
      fan.style.setProperty('--ch', ch + 'px');
      fan.style.setProperty('--cwbox', CW + 'px');
      fan.style.setProperty('--chbox', CH + 'px');
    }

    /* ---------- цепочка смыкается за фокусной обложкой ----------
       Крупная фокусная обложка выходит из ряда, и на её месте между
       соседями оставался просвет. Поэтому соседи подтягиваются друг к
       другу и закрывают его.

       Поправка нечётная и быстро затухает: у самой фокусной карты она
       равна нулю, на двух шагах уже мала, на трёх — незаметна. Поэтому
       длина цепочки и её края остаются прежними, а смыкание идёт
       непрерывно по мере движения колоды — без скачков на передаче
       фокуса. */
    let squeeze = 0;
    function fitSqueeze() {
      if (!desk() && !flat()) { squeeze = 0; return; }
      /* цель: соседи фокуса сходятся так, чтобы ещё и перекрыться */
      const want = Math.asin(clamp(cw * 0.92 / 2 / R, 0, 1)) * 180 / Math.PI;
      squeeze = Math.max(arcA() * Math.tanh(1 / arcK()) - want, 0);
    }
    const bend = d => -squeeze * d * Math.exp((1 - d * d) / 2);

    /* ---------- следующий номер не прячется за обложкой ----------
       Крупная фокусная обложка сдвинута вправо и шире карты, поэтому
       следующий номер оказывался целиком за ней: в ряду читалось, что
       после активного идёт номер через один. Правую половину ряда
       отодвигаем ровно настолько, чтобы следующая карта выглядывала
       из-за обложки на PEEK её ширины.

       Сдвиг постоянный — расстояния между картами справа не меняются
       и новых просветов не появляется. Его граница проходит по
       d = 0.5, то есть ровно там, где карта и так меняет позу на
       передаче фокуса: отдельного скачка от этого не возникает. */
    const PEEK = 0.42;          // насколько выглядывает следующий номер
    let pushDeg = 0;
    function fitPush() {
      if (!desk() && !flat()) { pushDeg = 0; return; }
      const coverR = W / 2 + W * ACT_DX + CW / 2;   // правый край обложки
      const want = coverR + PEEK * cw - cw / 2;     // где должен стоять следующий
      const a1 = Math.asin(clamp((want - W / 2) / R, -1, 1)) * 180 / Math.PI;
      pushDeg = Math.max(a1 - (arcA() * Math.tanh(1 / arcK()) + bend(1)), 0);
    }

    /** центр дуги для заданного положения верхней кромки веера */
    const arcCentre = topFrac => H * topFrac + ch / 2 + R;

    /**
     * Точка на дуге для смещения d (в шагах колоды) с общим доворотом spin.
     * Возвращает центр карты и её угол — этим же пользуется маскот,
     * когда веер «уносит» его с экрана.
     */
    function arcPoint(d, spin, topFrac) {
      if (!W) measure();
      const ang = arcA() * Math.tanh(d / arcK()) + (spin || 0);
      const rad = ang * Math.PI / 180;
      return {
        ang: ang,
        cx: W / 2 + R * Math.sin(rad),
        cy: arcCentre(topFrac) - R * Math.cos(rad),
        cw: cw, ch: ch
      };
    }

    /**
     * pos       — дробный индекс активной карты (может быть вне 0…11);
     * spin      — общий доворот всей дуги, градусы (минус — против часовой);
     * topFrac   — верхняя кромка веера, доля высоты сцены;
     * showActive— выделять ли центральную карту (на перелёте не нужно).
     */
    /** сплошная лента под маскотом: равномерный шаг, оба конца за кадром */
    function renderStrip(spin, topFrac) {
      if (!W) measure();
      const cy0 = arcCentre(topFrac);
      fan.classList.add('is-strip');
      for (let i = 0; i < strip.length; i++) {
        const ang = step * (i - CAT_I) + spin;
        const rad = ang * Math.PI / 180;
        const el = strip[i];
        const sc = 1 / SC;                   // бокс крупнее — карта ужимается до своего размера
        el.style.transform =
          'translate(' + (W / 2 + R * Math.sin(rad) - CW / 2).toFixed(1) + 'px,' +
          (cy0 - R * Math.cos(rad) - CH / 2).toFixed(1) + 'px) ' +
          'rotate(' + ang.toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ')';
        el.style.opacity = '1';
        el.style.setProperty('--dim', 0.7);
        el.style.setProperty('--fw', 0);
        el.classList.remove('is-active');
        /* веер сходится к карте под маскотом: она сверху, остальные
           уходят вглубь в обе стороны — как в бумажной стопке */
        const d = i - CAT_I;
        el.style.zIndex = 30 - Math.min(29, Math.abs(d));
        el.style.setProperty('--shx', d < 0 ? -1 : 1);
        el.classList.toggle('is-crown', d === 0);
      }
      /* активного выпуска в ленте нет: иначе на рисках оставался бы
         aria-selected от последнего показанного номера */
      if (active !== -1) tickEls.forEach(t => t.setAttribute('aria-selected', 'false'));
      active = -1;
    }

    /**
     * Веер выпусков: колода едет под неподвижным фокусом.
     * Положение карты считается от её расстояния до фокуса
     * (d = i − pos), поэтому вся цепочка непрерывно движется по дуге,
     * а фокусной становится та карта, что оказалась в её центре.
     */
    function render(pos, spin, topFrac, showActive) {
      if (!W) measure();
      fan.classList.remove('is-strip');
      const cy0 = arcCentre(topFrac);
      const near = Math.round(clamp(pos, 0, data.length - 1));
      const sc0 = 1 / SC;               // бокс крупнее — обычная карта ужимается

      const deskNow = desk(), flatNow = flat();
      /* Крупная фокусная обложка сдвинута вправо и там, и там:
         слева стоит текст выпуска. */
      const shiftAct = deskNow || flatNow;

      for (let i = 0; i < cards.length; i++) {
        const d = i - pos;
        const ang = arcA() * Math.tanh(d / arcK()) + bend(d)
                  + (d > 0.5 ? pushDeg : 0) + spin;
        const rad = ang * Math.PI / 180;
        const isActive = showActive && i === near;
        const lift = isActive ? -H * liftK() : 0;
        let sc = isActive ? 1 : sc0;
        let x = W / 2 + R * Math.sin(rad) - CW / 2;
        let y = cy0 - R * Math.cos(rad) - CH / 2 + lift;
        if (isActive && shiftAct) x += W * ACT_DX;
        if (isActive && deskNow) {
          /* Десктоп: обложка должна помещаться целиком — внизу у неё
             штрихкод и номер выпуска, а раньше она уходила за нижний
             край на 45–57 px на типовых ноутбучных окнах, и именно эта
             полоса срезалась. Если не помещается, ужимаем — но от
             ВЕРХНЕЙ кромки: верх остаётся на своём месте по макету.
             На остальных экранах размер обложки и так подобран по
             месту, а её низ намеренно стоит на кромке ОКНА, которая
             со спрятанной адресной строкой ниже сцены. */
          const max = H * (1 - ACT_BOT);
          if (y + CH > max) {
            sc = clamp((max - y) / CH, 0.62, 1);
            y -= CH * (1 - sc) / 2;
          }
        }
        const el = cards[i];
        el.style.transform =
          'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) ' +
          'rotate(' + ang.toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ')';
        el.style.opacity = '1';
        el.style.setProperty('--dim', isActive ? 0 : dimFor(Math.abs(d)));
        el.style.setProperty('--fw', isActive ? 1 : 0);
        /* тень падает в ту сторону, где обложка накрывает соседнюю */
        el.style.setProperty('--shx', d < 0 ? -1 : 1);
        el.classList.toggle('is-active', isActive);
        el.style.zIndex = isActive ? 30 : 10 - Math.min(9, Math.round(Math.abs(d)));
      }

      if (showActive && near !== active) {
        active = near;
        opts.onChange(data[near], near);
        tickEls.forEach((t, i) => t.setAttribute('aria-selected', i === near));
      }
    }

    /** смена языка: те же карты, другой комплект обложек и подписей */
    function setData(list) {
      data = list;
      cards.forEach((el, i) => {
        const item = list[i], img = el.firstElementChild;
        if (img.getAttribute('src') !== item.cover) img.src = item.cover;
        img.alt = opts.coverLabel() + ' ' + pad(item.n) + ': ' + item.title;
        el.setAttribute('aria-label', opts.issueLabel() + ' ' + pad(item.n) + ' — ' + item.title);
      });
      echo.forEach((el, i) => {
        const item = list[i % list.length], img = el.firstElementChild;
        if (img.getAttribute('src') !== item.cover) img.src = item.cover;
      });
      tickEls.forEach((t, i) => t.setAttribute('aria-label',
        opts.issueLabel() + ' ' + pad(list[i].n)));
      tickEls.forEach(t => t.setAttribute('aria-selected', 'false'));
      active = -1;               // заголовок перечитается на ближайшем кадре
    }

    /* своего обработчика resize здесь нет: раскладку пересобирает
       js/main.js и сам зовёт measure() — уже после того, как сообщит
       вееру новые пределы (setFocusLimit/setSideLimit). Отдельная
       подписка считала бы размеры дважды и первый раз по старым. */

    return { render, renderStrip, measure, arcPoint, setData,
             setFocusLimit: setFocusLimit, setRowHeight: setRowHeight,
             scale: () => SC, count: data.length,
             /* угловой шаг ленты и место маскота в ней: по ним считается
                длина проезда на перелёте (js/main.js) */
             stripStep: () => step, catIndex: CAT_I };
  }

  const dimFor = d => Math.min(0.82, 0.55 + d * 0.06);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const pad = n => String(n).padStart(2, '0');

  ns.Issues = { create };
})(window.CATALYST = window.CATALYST || {});
