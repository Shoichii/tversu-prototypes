/* admissions-sell / a — «Шансы первым»: калькулятор без кнопки, шкала, липкая панель, видео дня открытых дверей.
   Данные — демо-набор из <script id="programs-demo">. Пороги — пример, не проходные 2025. */
(function () {
  'use strict';

  var SCALE_MIN = 120, SCALE_MAX = 310;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* Пружина в стиле Motion: duration/bounce → жёсткость и затухание (масса 1).
     Прерываемая: новая цель подхватывает текущие позицию и скорость. */
  function Spring(onFrame) {
    var x = 0, v = 0, target = 0, k = 0, c = 0, raf = 0, last = 0, rest = null;
    function config(dur, bounce) {
      k = Math.pow(2 * Math.PI / dur, 2);
      c = 4 * Math.PI * (1 - bounce) / dur;
    }
    config(0.6, 0.15);
    function step(now) {
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      var n = Math.ceil(dt / (1 / 240)), h = dt / n;
      for (var i = 0; i < n; i++) { v += (-k * (x - target) - c * v) * h; x += v * h; }
      var done = Math.abs(v) < 0.05 && Math.abs(x - target) < 0.05;
      if (done) { x = target; v = 0; }
      onFrame(x);
      if (done) { raf = 0; last = 0; var r = rest; rest = null; if (r) r(); }
      else raf = requestAnimationFrame(step);
    }
    return {
      to: function (t, opts) {
        opts = opts || {};
        config(opts.dur || 0.6, opts.bounce == null ? 0.15 : opts.bounce);
        target = t; rest = opts.onRest || null;
        if (opts.instant) { x = t; v = 0; if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; onFrame(x); if (rest) { var r = rest; rest = null; r(); } return; }
        if (!raf) raf = requestAnimationFrame(step);
      },
      jump: function (t) { x = t; v = 0; },
      get value() { return x; }
    };
  }

  function countTo(el, from, to, dur) {
    if (reduce.matches || from === to) { el.textContent = to; return; }
    var t0 = performance.now();
    (function tick(now) {
      var p = Math.min(1, (now - t0) / dur), e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = Math.round(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  function initCalc(states) {
    var dataEl = document.getElementById('programs-demo');
    if (!dataEl) return;
    var data = JSON.parse(dataEl.textContent);
    var programs = data.programs, MIN = data.minScore;

    var $ = function (s) { return document.querySelector(s); };
    var f = { s1: $('#s1'), s2: $('#s2'), s3: $('#s3'), s4: $('#s4'), subj2: $('#s2-subj'), subj3: $('#s3-subj') };
    var scale = $('[data-scale]'), ticksEl = $('[data-ticks]'), marker = $('[data-marker]'), markerLabel = $('[data-marker-label]');
    var fill = $('[data-fill]');
    var title = $('[data-answer-title]'), live = $('[data-answer-live]'), empty = $('[data-empty]'), groups = $('[data-groups]'), other = $('[data-other]');
    var barSum = $('[data-actionbar-sum]');
    var motionOn = !reduce.matches;

    // Штрихи: по одному на программу (проходной на бюджет)
    var ticks = programs.map(function (p) {
      var t = document.createElement('span');
      t.className = 'tick';
      t.style.setProperty('--at', ((p.budget - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)).toFixed(4));
      ticksEl.appendChild(t);
      return t;
    });
    scale.classList.add('is-empty');

    // Градуировка прибора: риска через 10 баллов, крупные — у подписей оси (120, 180, 240, 310)
    var grad = $('[data-grad]');
    if (grad) {
      var frag = document.createDocumentFragment();
      for (var g = SCALE_MIN; g <= SCALE_MAX; g += 10) {
        var r = document.createElement('span');
        r.className = 'grad' + ((g - SCALE_MIN) % 60 === 0 || g === SCALE_MAX ? ' grad--major' : '');
        r.style.setProperty('--at', ((g - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)).toFixed(4));
        frag.appendChild(r);
      }
      grad.appendChild(frag);
    }

    /* ───── Маркер на пружине ─────
       Всё, что зависит от положения маркера, считается от ТЕКУЩЕГО значения пружины:
       заливка шкалы, число на ярлыке и в заголовке, штрихи, которые маркер уже проехал. */
    var demo = false, sumNum = null, lastTotal = null;
    var passLit = programs.map(function () { return false; });
    function drawMarker(x) {
      var p = Math.max(0, Math.min(1, (x - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)));
      marker.style.transform = 'translateX(' + (p * 100).toFixed(3) + '%)';
      markerLabel.style.transform = 'translateX(' + (-p * 100).toFixed(3) + '%)';
      fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      var shown = Math.round(Math.max(SCALE_MIN, Math.min(SCALE_MAX, x)));
      markerLabel.textContent = demo ? 'пример: ' + shown : shown;
      if (sumNum && !demo) sumNum.textContent = shown;
      programs.forEach(function (prog, i) {
        var eligible = demo || prog._fit;
        var lit = eligible && x >= prog.budget - 0.5 && (demo || (prog._sum >= prog.budget));
        if (lit !== passLit[i]) { passLit[i] = lit; ticks[i].classList.toggle('is-pass', lit); }
      });
    }
    var spring = Spring(drawMarker);
    spring.jump(SCALE_MIN);

    function readScore(input, max) {
      var clean = input.value.replace(/\D/g, '');
      if (clean !== input.value) input.value = clean;
      var err = document.getElementById(input.id + '-err');
      var msg = '';
      var v = clean === '' ? null : parseInt(clean, 10);
      if (v !== null && v > max) { msg = 'Максимум ' + max; v = null; }
      err.textContent = msg; err.hidden = !msg;
      if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      return v;
    }

    // Лучшая раскладка предметов по слотам программы
    function bestFit(p, scores) {
      var best = null;
      p.slots[0].forEach(function (a) {
        p.slots[1].forEach(function (b) {
          if (a === b || scores[a] == null || scores[b] == null) return;
          var s = scores[a] + scores[b];
          var low = scores[a] < MIN || scores[b] < MIN;
          if (!best || (best.low && !low) || (best.low === low && s > best.sum)) best = { sum: s, low: low };
        });
      });
      return best;
    }

    function item(p, delta, kind) {
      var sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
      var note = kind === 'near' ? 'не хватает' : kind === 'budget' ? 'запас' : 'до бюджета';
      var shown = kind === 'budget' ? sign + Math.abs(delta) : '−' + Math.abs(delta);
      var extra = '';
      if (kind === 'near') extra = p._target ? ' · целевое проходишь' : (p._paid ? ' · платно проходишь' : '');
      return '<li class="prog">' +
        '<span class="prog__name">' + esc(p.name) + '</span>' +
        '<span class="prog__margin"><span class="prog__delta">' + shown + '</span><span class="prog__delta-note">' + note + '</span></span>' +
        '<p class="prog__meta">' + esc(p.code) + ' · ' + esc(p.faculty) + '</p>' +
        '<p class="prog__pass">по&nbsp;проходным 2025: <span class="num">[N]</span>' + extra + ' · мест: <span class="num">[N]</span></p>' +
        '</li>';
    }

    var first = true, timer = null, lastVerdict = null;

    function compute() {
      var rus = readScore(f.s1, 100), a = readScore(f.s2, 100), b = readScore(f.s3, 100), ex = readScore(f.s4, 10);
      var e3 = document.getElementById('s3-err');
      if (f.subj2.value === f.subj3.value && f.s3.value !== '') {
        e3.textContent = 'Этот предмет уже выбран выше'; e3.hidden = false; f.s3.setAttribute('aria-invalid', 'true'); b = null;
      }
      if (rus == null || a == null || b == null) return renderEmpty();

      var scores = { rus: rus };
      scores[f.subj2.value] = a;
      scores[f.subj3.value] = b;
      var add = ex || 0;
      var total = rus + a + b + add;

      var res = { budget: [], near: [], target: [], paid: [] }, mismatch = 0, low = 0;
      programs.forEach(function (p) {
        var fit = bestFit(p, scores);
        p._fit = !!fit;
        if (!fit) { mismatch++; return; }
        if (fit.low || rus < MIN) { low++; p._fit = false; return; }
        var sum = rus + fit.sum + add;
        p._sum = sum; p._target = sum >= p.target; p._paid = sum >= p.paid;
        var d = sum - p.budget;
        if (d >= 0) res.budget.push([p, d]);
        else if (d >= -10) res.near.push([p, d]);
        else if (sum >= p.target) res.target.push([p, d]);
        else if (sum >= p.paid) res.paid.push([p, d]);
      });
      Object.keys(res).forEach(function (k) { res[k].sort(function (x, y) { return y[1] - x[1]; }); });

      render(total, res, mismatch, low);
    }

    function renderEmpty() {
      if (demo) return;
      title.textContent = 'Твоя сумма появится здесь';
      live.textContent = '';
      sumNum = null; lastVerdict = null; lastTotal = null;
      scale.classList.add('is-empty');
      programs.forEach(function (p) { p._fit = false; });
      ticks.forEach(function (t) { t.style.opacity = ''; });
      spring.to(SCALE_MIN, { instant: !motionOn });
      empty.hidden = false; groups.hidden = true;
      barSum.textContent = 'Посчитай баллы выше';
    }

    function stopDemo() {
      if (!demo) return;
      demo = false;
      scale.classList.remove('is-demo');
    }

    function render(total, res, mismatch, low) {
      stopDemo();
      scale.classList.remove('is-empty');
      programs.forEach(function (prog, i) { ticks[i].style.opacity = prog._fit ? '' : '0.25'; });

      var nb = res.budget.length;
      var verdict = nb ? 'бюджет в&nbsp;' + nb + '&nbsp;' + plural(nb, 'программе', 'программах', 'программах') : 'на&nbsp;бюджет пока не&nbsp;хватает';
      var from = lastTotal == null ? SCALE_MIN : Math.round(spring.value);
      title.innerHTML = 'Сумма <span class="num" data-sum>' + (motionOn ? Math.max(SCALE_MIN, Math.min(SCALE_MAX, from)) : total) + '</span> из 310: ' + verdict;
      sumNum = title.querySelector('[data-sum]');
      live.textContent = 'Сумма ' + total + ' из 310: ' + (nb ? 'бюджет в ' + nb + ' ' + plural(nb, 'программе', 'программах', 'программах') : 'на бюджет пока не хватает');
      // вердикт сменился — короткий штамп (резко, 180 мс); сумма при этом докручивается пружиной
      if (motionOn && lastVerdict !== null && lastVerdict !== verdict) {
        title.animate([{ transform: 'scale(1.035)', opacity: 0.55 }, { transform: 'none', opacity: 1 }], { duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
      }
      lastVerdict = verdict;
      lastTotal = total;
      spring.to(total, { instant: !motionOn, onRest: function () { if (sumNum) sumNum.textContent = total; } });
      if (!motionOn) drawMarker(total);
      barSum.innerHTML = 'Сумма <strong class="num">' + total + '</strong>' + (nb ? ' · бюджет: ' + nb : '');

      function paint() {
        ['budget', 'near', 'target', 'paid'].forEach(function (k) {
          var list = groups.querySelector('[data-list="' + k + '"]');
          var sec = list.closest('.group');
          var countEl = groups.querySelector('[data-group-count="' + k + '"]');
          countTo(countEl, parseInt(countEl.textContent, 10) || 0, res[k].length, 520);
          var old = sec.querySelector('.group__empty'); if (old) old.remove();
          list.innerHTML = res[k].map(function (r) { return item(r[0], r[1], k); }).join('');
          if (motionOn) {
            Array.prototype.forEach.call(list.children, function (li, n) {
              li.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
                { duration: 260, delay: Math.min(n, 6) * 40, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' });
            });
          }
          if (k === 'near') { sec.hidden = !res[k].length; return; }
          if (!res[k].length) {
            var m = document.createElement('p');
            m.className = 'group__empty';
            m.textContent = k === 'budget' ? 'Пока ни одной. Смотри «Почти» и целевое.' : 'Нет программ в этой группе.';
            sec.appendChild(m);
          }
        });
        var parts = [];
        if (mismatch) parts.push(mismatch + ' ' + plural(mismatch, 'программа требует', 'программы требуют', 'программ требуют') + ' других предметов');
        if (low) parts.push(low + ' ' + plural(low, 'программа', 'программы', 'программ') + ' с предметом ниже минимума ' + MIN + ' баллов');
        other.textContent = parts.length ? 'Ещё в демо-наборе: ' + parts.join('; ') + '.' : '';
        other.hidden = !parts.length;
        empty.hidden = true; groups.hidden = false;
        groups.classList.remove('is-updating');
      }

      if (first || !motionOn || groups.hidden) { paint(); first = false; }
      else { groups.classList.add('is-updating'); setTimeout(paint, 160); }
    }

    function schedule() { clearTimeout(timer); timer = setTimeout(compute, 250); }
    [f.s1, f.s2, f.s3, f.s4].forEach(function (i) {
      i.addEventListener('input', function () { touched = true; cancelDemo(); schedule(); });
    });
    [f.subj2, f.subj3].forEach(function (s) { s.addEventListener('change', function () { touched = true; cancelDemo(); compute(); }); });
    document.getElementById('scores').addEventListener('submit', function (e) { e.preventDefault(); compute(); });

    /* ───── Демонстрационный прогон: один раз, пока человек ничего не ввёл ─────
       Маркер выезжает до 262, штрихи вспыхивают по мере проезда, пауза, возврат и исчезновение.
       Любой ввод прерывает прогон: пружина едет к настоящей сумме с текущего места. */
    var touched = false, demoTimers = [];
    function cancelDemo() {
      demoTimers.forEach(clearTimeout); demoTimers = [];
      if (demo) { stopDemo(); if (lastTotal == null) { renderEmptyAfterDemo(); } }
    }
    function renderEmptyAfterDemo() {
      scale.classList.add('is-empty');
      programs.forEach(function (p, i) { passLit[i] = false; ticks[i].classList.remove('is-pass'); });
      spring.to(SCALE_MIN, { instant: true });
    }
    function runDemo() {
      if (touched || lastTotal != null || demo) return;
      demo = true;
      spring.jump(SCALE_MIN);
      scale.classList.add('is-demo');
      scale.classList.remove('is-empty');
      spring.to(262, { dur: 1.1, bounce: 0.12, onRest: function () {
        demoTimers.push(setTimeout(function () {
          if (!demo) return;
          spring.to(SCALE_MIN, { dur: 0.9, bounce: 0, onRest: function () {
            if (!demo) return;
            demo = false;
            scale.classList.remove('is-demo');
            renderEmptyAfterDemo();
          } });
        }, 1100));
      } });
    }

    if (states.has('calc-result')) {
      touched = true;
      f.s1.value = '78'; f.subj2.value = 'math'; f.s2.value = '72'; f.subj3.value = 'inf'; f.s3.value = '81'; f.s4.value = '5';
    }
    compute();

    if (motionOn && !touched && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (!entries.some(function (e) { return e.isIntersecting; })) return;
        io.disconnect();
        demoTimers.push(setTimeout(runDemo, 450));
      }, { rootMargin: '0px 0px -24px 0px' });
      io.observe(scale);
    }
  }

  function initActionbar() {
    var bar = document.querySelector('[data-actionbar]');
    if (!bar || !('IntersectionObserver' in window)) return;
    var targets = document.querySelectorAll('[data-main-cta], .steps__actions');
    var visible = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
      bar.classList.toggle('is-hidden', visible.size > 0);
    });
    targets.forEach(function (t) { io.observe(t); });
  }

  function initSubnav() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.subnav__link'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = new Map();
    links.forEach(function (l) { var s = document.querySelector(l.getAttribute('href')); if (s) map.set(s, l); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (l) { l.removeAttribute('aria-current'); });
        var l = map.get(e.target); l.setAttribute('aria-current', 'true');
        var list = l.closest('.subnav__list');
        var x = l.offsetLeft - 16;
        if (x < list.scrollLeft || l.offsetLeft + l.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollTo({ left: x, behavior: reduce.matches ? 'auto' : 'smooth' });
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    map.forEach(function (_, s) { io.observe(s); });
  }

  function initVideo() {
    var box = document.querySelector('[data-video]');
    if (!box) return;
    var btn = box.querySelector('[data-video-toggle]'), label = box.querySelector('[data-video-label]');
    var video = null;
    btn.addEventListener('click', function () {
      if (!video) {
        video = document.createElement('video');
        var small = window.matchMedia('(max-width: 767px)').matches;
        video.src = '../../../assets/stub/video/' + (small ? '480/' : '') + 'den-otkrytyh-dverey-2-mikroskop-mineraly.mp4';
        video.poster = '../../../assets/stub/video/den-otkrytyh-dverey-2-mikroskop-mineraly.jpg';
        video.muted = true; video.loop = true; video.playsInline = true;
        video.setAttribute('aria-label', 'Видео: день открытых дверей, микроскоп и минералы');
        box.insertBefore(video, btn);
      }
      if (video.paused) {
        video.play();
        btn.setAttribute('aria-pressed', 'true'); label.textContent = 'Пауза';
      } else {
        video.pause();
        btn.setAttribute('aria-pressed', 'false'); label.textContent = 'Смотреть дальше';
      }
    });
  }

  function initSubscribe() {
    var form = document.querySelector('[data-subscribe]');
    if (!form) return;
    var input = form.querySelector('input'), err = form.querySelector('.field__error'), ok = form.querySelector('.subscribe__ok');
    function valid(v) { v = v.trim(); return /^@[A-Za-z0-9_]{4,}$/.test(v) || v.replace(/\D/g, '').length === 11; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!valid(input.value)) { err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
      form.querySelector('.field').hidden = true; ok.hidden = false;
    });
    input.addEventListener('input', function () { if (!err.hidden && valid(input.value)) { err.hidden = true; input.removeAttribute('aria-invalid'); } });
  }

  function init() {
    var states = (window.TVSU && window.TVSU.states) || new Set();
    initCalc(states);
    initActionbar();
    initSubnav();
    initVideo();
    initSubscribe();
  }
  if (window.TVSU && window.TVSU.ready) window.TVSU.ready.then(init);
  else document.addEventListener('DOMContentLoaded', init);
})();
