/* Приёмка a — «Дедлайн» (тёмная минималистичная версия 15.09): табло-перекидка, шкала этапов, строка срочности у лида,
   связка калькулятора. Даты этапов — в data-date (условные), видимый текст остаётся [дата].
   ?state=deadline — «сегодня» за 4 дня до конца приёма. */
(function () {
  "use strict";
  const ADM = window.ADM;
  if (ADM.states.has("deadline")) ADM.todayOverride = "2027-07-21";

  function daysWord(n) { return ADM.plural(Math.abs(n), "день", "дня", "дней"); }

  const cssVar = (n, fb) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ───── Табло-перекидка (split-flap) ─────
     Каждый разряд — плитка из двух половин и двух листов. Смена символа: верхний лист падает (0 → −90°),
     нижний доезжает (90° → 0), 90 + 90 мс — резко, как механика. Разряды стартуют лесенкой слева направо,
     младший крутится дольше и садится последним. Читается скринридером через скрытый текст, плитки aria-hidden.
     Reduced-motion — сразу итоговые плитки. */
  function Flap(el) {
    const CH = " 0123456789";
    const sr = document.createElement("span");
    sr.className = "visually-hidden";
    const vis = document.createElement("span");
    vis.className = "flap";
    vis.setAttribute("aria-hidden", "true");
    el.textContent = "";
    el.append(sr, vis);
    const cells = [];
    let token = 0;

    function makeCell() {
      const d = document.createElement("span");
      d.className = "flap__d";
      d.innerHTML = '<span class="flap__h flap__top"></span><span class="flap__h flap__bot"></span>' +
        '<span class="flap__h flap__leaf flap__leaf--top"></span><span class="flap__h flap__leaf flap__leaf--bot"></span>';
      const [top, bot, lt, lb] = d.children;
      const c = { d, top, bot, lt, lb, ch: " ", job: Promise.resolve() };
      put(c, " ");
      return c;
    }
    function put(c, ch) {
      c.ch = ch;
      c.top.textContent = c.bot.textContent = ch;
      c.lt.hidden = c.lb.hidden = true;
    }
    async function flip(c, ch) {
      const outE = cssVar("--ease-in-out", "ease-in-out"), inE = cssVar("--ease-out", "ease-out");
      c.lt.textContent = c.ch; c.lb.textContent = ch;
      c.top.textContent = ch;                       // под падающим листом уже новый символ
      c.lt.hidden = false; c.lb.hidden = false;
      const fall = c.lt.animate([{ transform: "rotateX(0deg)", filter: "brightness(1)" }, { transform: "rotateX(-90deg)", filter: "brightness(0.6)" }], { duration: 90, easing: outE, fill: "both" });
      // нижний лист ждёт, пока верхний ляжет на ребро, и садится с жёсткой посадкой
      const land = c.lb.animate([
        { transform: "rotateX(90deg)", offset: 0 },
        { transform: "rotateX(90deg)", offset: 0.5, easing: inE },
        { transform: "rotateX(0deg)", offset: 1 },
      ], { duration: 180, fill: "both" });
      await Promise.all([fall.finished, land.finished]).catch(() => {});
      fall.cancel(); land.cancel();
      put(c, ch);
    }
    function plan(from, to, intro, i) {
      const ti = CH.indexOf(to), fi = CH.indexOf(from), L = CH.length;
      const dist = (ti - fi + L) % L;
      const n = intro ? (to === " " ? 0 : 3 + i * 2) : Math.min(dist, 3 + i);
      const seq = [];
      for (let k = n - 1; k >= 0; k--) seq.push(CH[(ti - k + L * 2) % L]);
      return seq;
    }
    const fit = (w) => {
      while (cells.length < w) { const c = makeCell(); cells.unshift(c); vis.prepend(c.d); }
      while (cells.length > w) cells.shift().d.remove();
    };
    return {
      blank(width, n) { fit(width); sr.textContent = String(n); },
      show(n, width, { intro = false } = {}) {
        const str = String(n).padStart(width, " ");
        sr.textContent = String(n);
        fit(str.length);
        const my = ++token;
        if (ADM.reduce.matches || !Element.prototype.animate) { cells.forEach((c, i) => put(c, str[i])); return; }
        cells.forEach((c, i) => {
          const target = str[i];
          c.job = c.job.then(async () => {
            if (intro) await wait(i * 70);
            if (my !== token) return;
            for (const ch of plan(c.ch, target, intro, i)) {
              if (my !== token) return;
              await flip(c, ch);
            }
          });
        });
      },
    };
  }

  function initCampaign() {
    const stages = [...document.querySelectorAll(".stage[data-date]")];
    if (!stages.length) return { label: "Приём 2027", days: null, endDays: null };
    const days = stages.map((s) => ADM.daysUntil(s.dataset.date));
    let nextIdx = days.findIndex((d) => d >= 0);

    stages.forEach((s, i) => {
      const d = days[i];
      const st = s.querySelector("[data-stage-status]");
      s.classList.toggle("is-past", d < 0);
      s.classList.toggle("is-next", i === nextIdx);
      st.textContent = d < 0 ? "завершён" : d === 0 ? "сегодня" : `через ${d} ${daysWord(d)}`;
    });

    // позиция «сегодня» на шкале: этапы стоят равномерно, внутри отрезка — по времени
    const n = stages.length;
    let pos;
    if (nextIdx === -1) pos = 1;
    else if (nextIdx === 0) pos = 0;
    else {
      const a = days[nextIdx - 1], b = days[nextIdx];
      const frac = a === b ? 1 : (0 - a) / (b - a);
      pos = (nextIdx - 1 + frac) / (n - 1);
    }
    // точки этапов стоят в центрах колонок: переводим в долю ширины трека
    const scale = document.querySelector(".campaign__scale");
    scale?.style.setProperty("--pos", String(pos));
    scale?.style.setProperty("--n", String(n));
    // линия прорисовывается до «сегодня», когда шкала попала в кадр
    if (scale) {
      if (ADM.reduce.matches || !("IntersectionObserver" in window)) scale.classList.add("is-drawn");
      else {
        const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { scale.classList.add("is-drawn"); io.disconnect(); } }, { threshold: 0.35 });
        io.observe(scale);
      }
    }

    // главная ячейка табло
    const startIdx = stages.findIndex((s) => s.dataset.kind === "start");
    const endIdx = stages.findIndex((s) => s.dataset.kind === "end");
    const cell = document.querySelector("[data-next-deadline]");
    const label = cell.querySelector("[data-next-label]");
    const num = cell.querySelector("[data-next-days]");
    const unit = cell.querySelector("[data-next-unit]");
    const flap = Flap(num);
    const width = Math.max(2, ...days.filter((d) => d >= 0).map((d) => String(d).length));

    const textFor = (i) => i === startIdx ? "До старта приёма документов"
      : i === endIdx ? "До конца приёма документов"
      : "До этапа: " + stages[i].querySelector(".stage__name").textContent.toLowerCase();

    let selIdx, target, text;
    if (days[startIdx] > 0) selIdx = startIdx;
    else if (days[endIdx] >= 0) selIdx = endIdx;
    else selIdx = nextIdx;
    if (selIdx === -1) { target = 0; text = "Кампания 2027 завершена"; }
    else { target = days[selIdx]; text = textFor(selIdx); }

    const hits = [];
    function select(i, { intro = false } = {}) {
      const d = i === -1 ? 0 : days[i];
      label.textContent = i === -1 ? text : textFor(i);
      unit.textContent = daysWord(d);
      cell.classList.toggle("is-urgent", i === endIdx || (d >= 0 && d <= 14));
      hits.forEach((h) => h.setAttribute("aria-pressed", String(Number(h.dataset.i) === i)));
      stages.forEach((s, k) => s.classList.toggle("is-selected", k === i));
      flap.show(d, width, { intro });
    }

    // будущие этапы — кнопки: нажатие перекидывает табло на этот этап (резко, механикой)
    stages.forEach((s, i) => {
      if (days[i] < 0) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "stage__hit";
      b.dataset.i = i;
      b.setAttribute("aria-pressed", "false");
      b.innerHTML = `<span class="visually-hidden">Показать на табло: ${ADM.esc(s.querySelector(".stage__name").textContent)}</span>`;
      b.addEventListener("click", () => select(i));
      s.append(b);
      hits.push(b);
    });

    // табло стартует, когда его видно (на первом экране — сразу после заголовка)
    const startBoard = () => select(selIdx, { intro: true });
    if (ADM.reduce.matches || !("IntersectionObserver" in window)) select(selIdx);
    else {
      flap.blank(width, target); // пустые плитки до старта, число уже в скрытом тексте
      const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); setTimeout(startBoard, 260); } }, { threshold: 0.4 });
      io.observe(cell);
    }

    return { label: text, days: target, endDays: endIdx === -1 ? null : days[endIdx] };
  }

  function init() {
    const info = initCampaign();
    ADM.initStickyBar(document.querySelector("[data-sticky-cta]"));
    ADM.initChat(document.querySelector("[data-chat]"));
    ADM.initLead(document.querySelector("[data-lead]"));

    const sticky = document.querySelector("[data-sticky-days]");
    if (sticky && info.days != null) sticky.textContent = `${info.label}: ${info.days} ${daysWord(info.days)}`;

    // срочность над лидом: всегда про конец приёма, а не про выбранный на табло этап
    const askLine = document.querySelector("[data-ask-deadline]");
    if (askLine && info.endDays != null) {
      const d = info.endDays;
      askLine.textContent = d > 0 ? `До конца приёма документов: ${d} ${daysWord(d)}`
        : d === 0 ? "Сегодня последний день приёма документов" : "Приём документов 2027 завершён";
    }

    const form = document.querySelector("[data-calc]");
    const empty = document.querySelector("[data-calc-empty]");
    // куда писать результат, задаёт data-calc-result="#calc-result" на форме (не селектор атрибута: он поймал бы саму форму)
    const result = document.getElementById("calc-result");
    new MutationObserver(() => { empty.hidden = !result.hidden; }).observe(result, { attributes: true, attributeFilter: ["hidden"] });
    ADM.initCalc(form, { limit: 5 });

    // ссылки на конкретный вопрос (из чата) раскрывают его
    document.querySelectorAll('a[href^="#faq-"]').forEach((a) => a.addEventListener("click", () => {
      document.getElementById(a.getAttribute("href").slice(1))?.setAttribute("open", "");
    }));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
