/* Приёмка b — «Поиск»: combobox с живой выдачей из programs.json, фильтры-чипы, полоса счётчиков.
   ?state=search-results — введено «эконом», выдача открыта. ?state=deadline — «сегодня» за 4 дня до конца приёма. */
(function () {
  "use strict";
  const ADM = window.ADM;
  const E = ADM.esc;
  if (ADM.states.has("deadline")) ADM.todayOverride = "2027-07-21";
  const daysWord = (n) => ADM.plural(Math.abs(n), "день", "дня", "дней");
  const norm = (s) => String(s).toLowerCase().replace(/ё/g, "е");

  /* профессии и слова абитуриента → коды направлений (демо) */
  const SYN = {
    "юрист": ["40.03.01"], "право": ["40.03.01"], "адвокат": ["40.03.01"], "следовател": ["40.03.01"],
    "программист": ["01.03.02", "02.03.02", "09.03.03"], "айти": ["01.03.02", "02.03.02", "09.03.03"], "it": ["01.03.02", "02.03.02", "09.03.03"], "разработчик": ["01.03.02", "02.03.02", "09.03.03"],
    "психолог": ["37.03.01", "44.03.02"], "учитель": ["44.03.01", "44.03.02"], "педагог": ["44.03.01", "44.03.02"], "дети": ["44.03.01", "44.03.02"],
    "журналист": ["42.03.02"], "медиа": ["42.03.02"], "переводчик": ["45.03.02"], "язык": ["45.03.02", "45.03.01"],
    "экономист": ["38.03.01"], "бухгалтер": ["38.03.01"], "финанс": ["38.03.01"], "менеджер": ["38.03.02", "38.03.04"], "управлен": ["38.03.02", "38.03.04"], "чиновник": ["38.03.04"],
    "эколог": ["05.03.06"], "химик": ["04.03.01", "18.03.01"], "технолог": ["18.03.01"], "биолог": ["06.03.01"], "генетик": ["06.03.01"],
    "историк": ["46.03.01"], "архив": ["46.03.01"], "дипломат": ["41.03.05"], "тренер": ["49.03.01"], "спорт": ["49.03.01"],
    "физик": ["03.03.02", "03.03.03"], "инженер": ["03.03.03", "18.03.01"], "математик": ["01.03.01", "01.03.02"], "аналитик": ["01.03.02", "38.03.01", "09.03.03"],
    "географ": ["05.03.02"], "туризм": ["43.03.02"], "социолог": ["39.03.01"], "маркетолог": ["38.03.02", "39.03.01"], "писател": ["45.03.01", "42.03.02"], "филолог": ["45.03.01"],
  };

  /* ───── Полоса счётчиков ───── */
  function initTicker() {
    const t = document.querySelector("[data-ticker]");
    const start = ADM.daysUntil(t.dataset.start);
    const end = ADM.daysUntil(t.dataset.end);
    let label, n;
    if (start > 0) { label = "До старта приёма"; n = start; }
    else if (end >= 0) { label = "До конца приёма"; n = end; t.classList.add("is-urgent"); }
    else { label = "Приём 2027 завершён"; n = 0; }
    t.querySelector("[data-ticker-label]").textContent = label;
    t.querySelector("[data-ticker-unit]").textContent = daysWord(n);
    const num = t.querySelector("[data-ticker-days]");
    // докрутка, когда полоса попала в кадр (на 390 она ниже первого экрана)
    if ("IntersectionObserver" in window && !ADM.reduce.matches) {
      const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { ADM.countTo(num, n, { duration: 800 }); io.disconnect(); } }, { threshold: 0.5 });
      io.observe(t);
    } else num.textContent = n;
    const sticky = document.querySelector("[data-sticky-days]");
    if (sticky) sticky.textContent = `${label}: ${n} ${daysWord(n)}`;
  }

  /* ───── Поиск ───── */
  function initSearch(data) {
    const root = document.querySelector("[data-search]");
    const input = root.querySelector("#q");
    const pop = root.querySelector("[data-search-pop]");
    const list = root.querySelector("#q-list");
    const empty = root.querySelector("[data-search-empty]");
    const foot = root.querySelector("[data-search-foot]");
    const count = root.querySelector("[data-search-count]");
    const clear = root.querySelector("[data-search-clear]");
    const chips = [...root.querySelectorAll("[data-filter]")];
    const picked = document.querySelector("[data-picked]");
    const actions = document.querySelector(".finder__actions");
    const LIMIT = 5;
    let results = [], active = -1, ready = false;

    const subjName = (s) => data.subjects[s] || s;
    const exams = (p) => [...p.required.map(subjName), p.choice.length ? p.choice.map(subjName).join(" / ") : p.extra].filter(Boolean).join(" + ");
    const filters = () => new Set(chips.filter((c) => c.getAttribute("aria-pressed") === "true").map((c) => c.dataset.filter));
    const passFilters = (p, f) =>
      (!f.has("budget") || p.budget) &&
      (!f.has("full") || p.forms.includes("очно")) &&
      (!f.has("nophys") || (!p.required.includes("phys") && !p.choice.includes("phys")));

    function scoreProgram(p, tokens) {
      const name = norm(p.name), fac = norm(p.faculty);
      const subj = norm([...p.required, ...p.choice].map(subjName).join(" "));
      let total = 0;
      for (const t of tokens) {
        let s = 0;
        if (name.split(/[\s-]+/).some((w) => w.startsWith(t))) s = 100;
        else if (name.includes(t)) s = 70;
        if (p.code.startsWith(t)) s = Math.max(s, 60);
        for (const [k, codes] of Object.entries(SYN)) {
          if ((k.startsWith(t) && t.length >= 2) || (t.startsWith(k) && k.length >= 4)) { if (codes.includes(p.code)) s = Math.max(s, 85); }
        }
        if (t.length >= 3 && fac.includes(t)) s = Math.max(s, 40);
        if (t.length >= 4 && subj.includes(t)) s = Math.max(s, 30);
        if (!s) return 0;
        total += s;
      }
      return total;
    }

    function highlight(text, tokens) {
      const n = norm(text);
      let best = null;
      for (const t of tokens) {
        const re = new RegExp("(^|[\\s-])" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        const m = re.exec(n);
        const i = m ? m.index + m[1].length : n.indexOf(t);
        if (i >= 0 && (!best || t.length > best[1])) best = [i, t.length];
      }
      if (!best) return E(text);
      const [i, len] = best;
      return E(text.slice(0, i)) + "<mark>" + E(text.slice(i, i + len)) + "</mark>" + E(text.slice(i + len));
    }

    /* ───── Живая выдача ─────
       Строки ключуются по коду направления и не пересоздаются: оставшиеся переезжают FLIP (WAAPI, 280 мс),
       новые входят лесенкой 35 мс, ушедшие вынимаются из потока и схлопываются за 160 мс; блоки под выдачей
       тоже переезжают, а не прыгают. Первый запрос показывает скелетон «загрузки». Reduced-motion — мгновенно. */
    const still = () => ADM.reduce.matches || !Element.prototype.animate;
    const easeOut = () => getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() || "ease-out";
    const below = () => [root.querySelector(".search__hint"), document.querySelector(".finder__try"), actions, picked].filter((el) => el && !el.hidden);
    let warmed = false;

    function morph(mutate) {
      if (still()) { mutate(); return; }
      const els = [...list.querySelectorAll(".search__opt:not(.is-leaving)"), ...below()];
      const first = new Map(els.map((el) => [el, el.getBoundingClientRect().top]));
      els.forEach((el) => el.getAnimations().forEach((an) => { if (an.id === "flip") an.cancel(); }));
      mutate();
      const ease = easeOut();
      first.forEach((top, el) => {
        if (!el.isConnected || el.hidden || el.classList.contains("is-leaving") || el.classList.contains("is-new")) return;
        const dy = top - el.getBoundingClientRect().top;
        if (Math.abs(dy) < 0.5) return;
        el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 280, easing: ease, id: "flip" });
      });
    }

    function rowInner(p, tokens) {
      return `
          <span class="search__opt-main">
            <span class="search__opt-name">${highlight(p.name, tokens)}</span>
            <span class="search__opt-meta"><span class="num">${E(p.code)}</span> · ${E(p.faculty)}</span>
            <span class="search__opt-exams">ЕГЭ: ${E(exams(p))}</span>
          </span>
          <span class="search__opt-side">
            <span class="search__tag${p.budget ? " search__tag--budget" : ""}">${p.budget ? "Бюджет [N]" : "Платно"}</span>
            <span class="search__opt-pass">проходной 2025: [N]</span>
          </span>`;
    }

    function setCount(n) {
      const prev = Number(count.dataset.n || 0);
      if (prev === n && count.textContent) return;
      count.dataset.n = n;
      count.innerHTML = n ? `Найдено: <span class="search__count-n num">${n}</span>` : "";
      // счётчик щёлкает резко, как механический: больше — новое число снизу, меньше — сверху
      if (n && prev && !still()) {
        count.querySelector("span").animate(
          [{ transform: `translateY(${n > prev ? 70 : -70}%)`, opacity: 0 }, { transform: "none", opacity: 1 }],
          { duration: 140, easing: easeOut() });
      }
    }

    function renderRows(top, tokens) {
      const ease = easeOut();
      const popTop = pop.getBoundingClientRect().top + pop.clientTop;
      const old = [...list.children].filter((li) => !li.classList.contains("is-leaving"));
      const byCode = new Map(old.filter((li) => li.dataset.code).map((li) => [li.dataset.code, li]));
      const keep = new Set(top.map(({ p }) => p.code));
      const leaving = old.filter((li) => !li.dataset.code || !keep.has(li.dataset.code));
      // ушедшие: зафиксировать на месте вне потока до схлопывания
      if (!still() && !pop.hidden) {
        leaving.forEach((li) => {
          const r = li.getBoundingClientRect();
          li.classList.add("is-leaving");
          li.removeAttribute("id");
          li.setAttribute("aria-hidden", "true");
          li.style.top = `${r.top - popTop}px`;
        });
      } else leaving.forEach((li) => li.remove());

      let fresh = 0;
      top.forEach(({ p }, i) => {
        let li = byCode.get(p.code);
        if (!li) {
          li = document.createElement("li");
          li.className = "search__opt";
          li.setAttribute("role", "option");
          li.dataset.code = p.code;
          li.innerHTML = rowInner(p, tokens);
          li.querySelector(".search__opt-name").dataset.h = highlight(p.name, tokens);
          if (!still()) { li.classList.add("is-new"); li.style.setProperty("--i", fresh++); }
        } else {
          li.classList.remove("is-new");
          const nm = li.querySelector(".search__opt-name");
          const html = highlight(p.name, tokens);
          if (nm.dataset.h !== html) nm.innerHTML = html;
          nm.dataset.h = html;
        }
        li.id = `q-opt-${i}`;
        li.setAttribute("aria-selected", "false");
        list.append(li);
      });
      leaving.forEach((li) => { if (li.isConnected) list.append(li); });

      if (still()) return;
      list.querySelectorAll(".search__opt.is-new").forEach((li) => {
        li.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }],
          { duration: 320, easing: ease, delay: Number(li.style.getPropertyValue("--i")) * 35, fill: "backwards" });
      });
      leaving.forEach((li) => {
        const an = li.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.98) translateY(-6px)" }], { duration: 160, easing: ease, fill: "forwards" });
        an.finished.then(() => li.remove(), () => li.remove());
      });
    }

    function run({ animate = false } = {}) {
      const q = norm(input.value.trim());
      const tokens = q.split(/\s+/).filter(Boolean);
      const f = filters();
      clear.hidden = !input.value;
      if (!tokens.length && !f.size) { close(); setCount(0); return; }
      if (!ready) { renderSkeleton(); return; }
      // первый запрос: короткий скелетон, будто выдача грузится с сервера
      if (!warmed && !still()) {
        warmed = true;
        renderSkeleton();
        setTimeout(() => run({ animate }), 360);
        return;
      }
      warmed = true;
      results = data.programs
        .filter((p) => passFilters(p, f))
        .map((p) => ({ p, s: tokens.length ? scoreProgram(p, tokens) : 1 }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name, "ru"));
      setCount(results.length);
      active = -1;
      input.removeAttribute("aria-activedescendant");
      morph(() => {
        open(animate);
        renderRows(results.slice(0, LIMIT), tokens);
        empty.hidden = results.length > 0;
        root.querySelector("[data-search-term]").textContent = input.value.trim() || "с этими фильтрами";
        foot.hidden = results.length <= LIMIT;
        root.querySelector("[data-search-total]").textContent = `Показаны ${Math.min(LIMIT, results.length)} из ${results.length}`;
      });
      if (!results.length && !still()) empty.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: easeOut() });
    }

    function renderSkeleton() {
      morph(() => {
        open(false);
        const skel = Array.from({ length: 3 }, () => { const li = document.createElement("li"); li.className = "search__skel"; li.setAttribute("aria-hidden", "true"); li.innerHTML = "<span></span><span></span>"; return li; });
        [...list.children].forEach((li) => li.remove());
        list.append(...skel);
        empty.hidden = true; foot.hidden = true;
      });
    }

    function open() {
      const wasHidden = pop.hidden;
      pop.hidden = false;
      input.setAttribute("aria-expanded", "true");
      root.classList.add("is-open");
      if (wasHidden && !still()) pop.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: easeOut() });
    }
    function close() {
      if (pop.hidden) return;
      morph(() => {
        pop.hidden = true;
        [...list.children].forEach((li) => li.remove());
      });
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      root.classList.remove("is-open");
      active = -1;
    }
    function setActive(i) {
      const opts = [...list.querySelectorAll(".search__opt:not(.is-leaving)")];
      if (!opts.length) return;
      active = (i + opts.length) % opts.length;
      opts.forEach((o, k) => o.setAttribute("aria-selected", String(k === active)));
      input.setAttribute("aria-activedescendant", opts[active].id);
    }

    function pick(p, { scroll = false } = {}) {
      input.value = p.name;
      clear.hidden = false;
      close();
      picked.innerHTML = `
        <div class="picked__head">
          <span class="picked__code num">${E(p.code)} · ${E(p.level)}</span>
          <button class="picked__close" type="button" data-picked-close><svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6l-12 12"/><path d="M6 6l12 12"/></svg><span class="visually-hidden">Закрыть</span></button>
        </div>
        <p class="picked__name">${E(p.name)}</p>
        <p class="picked__fac">${E(p.faculty)}</p>
        <dl class="picked__nums">
          <div><dt>Экзамены ЕГЭ</dt><dd>${E(exams(p))}</dd></div>
          <div><dt>Бюджетных мест</dt><dd class="num">${p.budget ? "[N]" : "только платно"}</dd></div>
          <div><dt>Проходной 2025</dt><dd class="num">[N]</dd></div>
          <div><dt>Форма</dt><dd>${E(p.forms.join(", "))}</dd></div>
        </dl>
        <div class="picked__actions">
          <a class="btn btn--accent" href="#">Подать документы</a>
          <a class="btn btn--text" href="#calc">Проверить мои баллы <span class="icon icon--arrow-right" aria-hidden="true"></span></a>
        </div>`;
      morph(() => { picked.hidden = false; actions.hidden = true; });
      picked.querySelector("[data-picked-close]").addEventListener("click", () => {
        picked.hidden = true; actions.hidden = false; input.focus();
      });
      if (scroll) {
        document.querySelector(".finder").scrollIntoView({ behavior: ADM.reduce.matches ? "auto" : "smooth" });
        picked.focus({ preventScroll: true });
      }
    }

    input.addEventListener("input", () => { picked.hidden = true; actions.hidden = false; run(); });
    input.addEventListener("focus", () => { if (input.value.trim() && picked.hidden) run(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); if (pop.hidden) run(); setActive(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const r = results[active >= 0 ? active : 0];
        if (!pop.hidden && r) pick(r.p);
      } else if (e.key === "Escape") {
        if (!pop.hidden) close(); else { input.value = ""; clear.hidden = true; }
      }
    });
    list.addEventListener("mousedown", (e) => e.preventDefault());
    list.addEventListener("click", (e) => {
      const li = e.target.closest(".search__opt");
      if (!li) return;
      const r = results.find((x) => x.p.code === li.dataset.code);
      if (r) pick(r.p);
    });
    list.addEventListener("mousemove", (e) => {
      const li = e.target.closest(".search__opt:not(.is-leaving)");
      if (li) setActive([...list.querySelectorAll(".search__opt:not(.is-leaving)")].indexOf(li));
    });
    clear.addEventListener("click", () => { input.value = ""; picked.hidden = true; actions.hidden = false; run(); input.focus(); });
    chips.forEach((c) => c.addEventListener("click", () => {
      c.setAttribute("aria-pressed", String(c.getAttribute("aria-pressed") !== "true"));
      run();
    }));
    document.addEventListener("click", (e) => { if (!root.contains(e.target) && !e.target.closest("[data-try]")) close(); });
    document.querySelectorAll("[data-try]").forEach((b) => b.addEventListener("click", () => {
      input.value = b.dataset.try;
      picked.hidden = true; actions.hidden = false;
      input.focus();
      run({ animate: true });
    }));

    ready = true;
    return { pick, run, input };
  }

  async function init() {
    initTicker();
    ADM.initSubnav(document.querySelector(".subnav"));
    ADM.initStickyBar(document.querySelector("[data-sticky-cta]"));
    ADM.initChat(document.querySelector("[data-chat]"));
    ADM.initLead(document.querySelector("[data-lead]"));
    document.querySelectorAll('.subnav a[href="#faq"]').forEach((a) => a.addEventListener("click", () => document.getElementById("docs")?.setAttribute("open", "")));

    const data = await ADM.data;
    const search = initSearch(data);
    ADM.initCalc(document.querySelector("[data-calc]"), {
      limit: 5,
      onPick: (name) => { const p = data.programs.find((x) => x.name === name); if (p) search.pick(p, { scroll: true }); },
    });

    if (ADM.states.has("search-results")) {
      search.input.value = "эконом";
      search.run();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
