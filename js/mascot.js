/* =========================================================
   Главный маскот: взгляд следует за курсором.

   Геометрия берётся из assets/hero/hero.json — она посчитана
   по исходникам: окно вывода совпадает с вырезанным отверстием
   глаза в mascot-without-eyes (там прозрачность, а не чёрный),
   поэтому естественная тёмная обводка века не затрагивается.
   travelX/travelY — предельный ход яблока, при котором отверстие
   остаётся закрытым полностью и просветов не появляется.
   ========================================================= */
(function (ns) {
  'use strict';

  const EASE      = 0.16;   // инерция взгляда
  const LOOK_GAIN = 0.90;   // доля предельного хода при полном отклонении
  /* параллакс головы выключен: за курсором следует только взгляд.
     Раньше на фигуру всё равно писались --tilt/--px/--py (всегда ноль)
     каждый кадр — трансформация маскота из-за этого пересчитывалась
     постоянно, даже когда страница стоит. Теперь не пишем ничего. */
  const STEP      = 0.0004; // ниже этого порога взгляд считается пришедшим
  const RECT_TTL  = 250;    // как часто перемеряем положение фигуры, мс

  function create(root, opts) {
    opts = opts || {};
    const state = {
      root, eyes: [], balls: [],
      tx: 0, ty: 0, cx: 0, cy: 0,
      look: 1, ready: false
    };

    // геометрия приходит объектом (js/hero-eyes.js). Никакого fetch:
    // страница должна работать и при открытии файла с диска.
    if (opts.meta && opts.meta.eyes) build(state, opts.meta, opts);
    else console.warn('[mascot] геометрия глаз не передана');

    /* Кадры рисуем ТОЛЬКО пока взгляд едет. Постоянный цикл
       requestAnimationFrame соревновался со скроллом: на телефоне из-за
       него фигура заметно дёргалась, на десктопе — подрагивала. */
    let raf = 0, drawn = -1;
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

    /* Положение фигуры для наведения взгляда меряем не чаще, чем раз
       в RECT_TTL: getBoundingClientRect на элементе, который прямо
       сейчас двигают трансформацией, заставляет браузер пересчитывать
       раскладку синхронно — а указатель шлёт события пачками. */
    let rect = null, rectAt = -1e9;
    const ptr = { x: 0, y: 0, on: false };
    function aim(now) {
      if (!ptr.on) return;
      if (now - rectAt > RECT_TTL) { rect = root.getBoundingClientRect(); rectAt = now; }
      if (!rect || !rect.width) return;
      const ax = rect.left + rect.width / 2;
      const ay = rect.top + rect.height * 0.30;    // якорь — примерно уровень глаз
      state.tx = clamp((ptr.x - ax) / (rect.width * 1.1), -1, 1);
      state.ty = clamp((ptr.y - ay) / (rect.height * 0.8), -1, 1);
    }

    window.addEventListener('pointermove', ev => {
      ptr.x = ev.clientX; ptr.y = ev.clientY; ptr.on = true;
      kick();
    }, { passive: true });

    /* На тач-устройствах курсора нет: лёгкое «дыхание» взгляда. Во
       время прокрутки оно останавливается — там каждый лишний кадр
       виден как рывок фигуры. */
    const touch = !window.matchMedia('(hover: hover)').matches;
    let scrollAt = -1e9;
    if (touch) {
      let idle = 0;
      window.addEventListener('scroll', () => {
        scrollAt = performance.now();
        /* цикл будим один раз, когда прокрутка закончилась, —
           постоянного таймера на странице не остаётся */
        window.clearTimeout(idle);
        idle = window.setTimeout(kick, 200);
      }, { passive: true });
    }
    function breathe(now) {
      if (!touch || state.look < 0.01 || now - scrollAt < 180) return false;
      const t = now / 1000;
      state.tx = Math.sin(t) * 0.5;
      state.ty = Math.sin(t * 0.6) * 0.35;
      return true;
    }

    function frame(now) {
      raf = 0;
      const live = breathe(now);
      aim(now);
      state.cx += (state.tx - state.cx) * EASE;
      state.cy += (state.ty - state.cy) * EASE;

      if (state.ready) {
        // ход ограничен единичным кругом: по диагонали пределы иначе складываются
        let ex = state.cx, ey = state.cy;
        const len = Math.hypot(ex, ey);
        if (len > 1) { ex /= len; ey /= len; }
        for (let i = 0; i < state.balls.length; i++) {
          const e = state.eyes[i];
          const dx = ex * e.travelX * LOOK_GAIN * state.look * 100;
          const dy = ey * e.travelY * LOOK_GAIN * state.look * 100;
          state.balls[i].style.transform =
            'translate(' + dx.toFixed(2) + '%,' + dy.toFixed(2) + '%)';
        }
        drawn = state.look;
      }
      if (live ||
          Math.abs(state.tx - state.cx) > STEP ||
          Math.abs(state.ty - state.cy) > STEP) kick();
    }
    kick();

    return {
      el: root,
      /** 0…1 — насколько активен взгляд (гасим, когда маскот уходит) */
      setLook(v) {
        const n = clamp(v, 0, 1);
        if (n === state.look) return;
        state.look = n;
        if (n !== drawn) kick();
      }
    };
  }

  function build(state, meta, opts) {
    const base = opts.basePath || 'assets/hero/';
    meta.eyes.forEach((e, i) => {
      const socket = document.createElement('div');
      socket.className = 'hero__socket';
      socket.style.left   = pct(e.x);
      socket.style.top    = pct(e.y);
      socket.style.width  = pct(e.w);
      socket.style.height = pct(e.h);
      const url = 'url("' + (e.mask || base + 'mask' + i + '.png') + '")';
      socket.style.webkitMaskImage = url;   // CSS-маска читает АЛЬФУ, не яркость
      socket.style.maskImage = url;

      const ball = document.createElement('img');
      ball.className = 'hero__eye';
      ball.src = base + 'eye' + i + '.png';
      ball.alt = '';
      ball.style.width  = pct(e.ballW);
      ball.style.height = pct(e.ballH);
      ball.style.left   = pct(e.ballLeft);
      ball.style.top    = pct(e.ballTop);

      /* тень века не накладывается слоем: она уже есть в самом
         изображении яблока (assets/hero/eye*.png) */
      socket.appendChild(ball);
      state.root.appendChild(socket);
      state.eyes.push(e);
      state.balls.push(ball);
    });
    state.ready = true;
  }

  const pct   = v => (v * 100) + '%';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  ns.Mascot = { create };
})(window.CATALYST = window.CATALYST || {});
