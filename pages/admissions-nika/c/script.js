/* admissions-nika — поведение страницы приёмки (одинаковый файл в a/b/c).
   Подменю раздела, липкая панель «Подать документы», плавающая «Задать вопрос», калькулятор ЕГЭ,
   форма вопроса, фоновое видео (b), маршрут, связанный с прокруткой (c).
   Появления при скролле — общий слой system/motion.js (data-m*); своих IntersectionObserver-reveal здесь нет.
   Состояния: ?state=calc-result (калькулятор посчитан), ?state=lead-sent (вопрос отправлен). */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const motionOn = () => document.documentElement.classList.contains("m-on");
  const rescan = (root) => window.TVSU_MOTION && window.TVSU_MOTION.scan(root);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const states = () => (window.TVSU && window.TVSU.states) ||
    new Set((new URLSearchParams(location.search).get("state") || "").split(",").map((s) => s.trim()).filter(Boolean));
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  /* ───── Шапка: компактная → подменю встаёт под неё ───── */
  function watchHeader() {
    const header = $(".site-header");
    if (!header) return;
    const sync = () => document.body.classList.toggle("hdr-compact", header.classList.contains("is-compact"));
    new MutationObserver(sync).observe(header, { attributes: true, attributeFilter: ["class"] });
    sync();
  }

  /* ───── Подменю: активный пункт по прокрутке, лента докручивает активный пункт в зону видимости ───── */
  function initSubnav() {
    const nav = $(".adm-sub");
    if (!nav || !("IntersectionObserver" in window)) return;
    const links = $$(".adm-sub__link", nav);
    const map = new Map();
    links.forEach((a) => { const t = document.getElementById(a.hash.slice(1)); if (t) map.set(t, a); });
    const visible = new Set();
    let current = null;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
      const first = [...map.keys()].find((t) => visible.has(t));
      const link = first ? map.get(first) : null;
      if (link === current) return;
      if (current) current.removeAttribute("aria-current");
      current = link;
      if (link) {
        link.setAttribute("aria-current", "true");
      }
    }, { rootMargin: "-140px 0px -55% 0px" });
    map.forEach((_, t) => io.observe(t));
  }

  /* ───── Липкая панель и плавающая кнопка ───── */
  function initSticky() {
    const bar = $(".adm-bar");
    const fab = $(".adm-fab");
    if (!("IntersectionObserver" in window)) return;
    const seen = { cta: false, ask: false, calc: false };
    const apply = () => {
      if (bar) bar.classList.toggle("is-hidden", seen.cta || seen.ask);
      if (fab) fab.classList.toggle("is-hidden", seen.cta || seen.ask);
    };
    const watch = (el, key) => {
      if (!el) return;
      new IntersectionObserver((es) => { seen[key] = es.some((e) => e.isIntersecting); apply(); }).observe(el);
    };
    watch($("[data-cta-primary]"), "cta");
    watch($("#ask"), "ask");
  }

  /* ───── Поиск программы в hero ───── */
  function initSearch(programs) {
    $$("[data-program-search]").forEach((form) => {
      const input = $("input", form);
      const hint = $(".adm-search__hint", form.parentElement);
      const hits = $(".adm-hits", form.parentElement);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = input.value.trim().toLowerCase();
        if (!hint) return;
        if (hits) { hits.hidden = true; hits.textContent = ""; }
        if (!q) { hint.textContent = "Начните вводить: например, «юриспруденция» или «информатика»."; input.focus(); return; }
        const found = programs.filter((p) => (p.name + " " + p.fac).toLowerCase().includes(q));
        if (!found.length) { hint.textContent = "В примере такой программы нет. Откройте каталог: там все 129 программ."; return; }
        const more = found.length > 3 ? ` Ещё ${found.length - 3} в каталоге программ.` : " Полный список в каталоге программ.";
        if (!hits) {
          hint.textContent = `В примере ${found.length} ${plural(found.length, "программа", "программы", "программ")}: ${found.slice(0, 3).map((p) => p.name).join(", ")}.${more}`;
          return;
        }
        hint.textContent = `В примере ${found.length} ${plural(found.length, "программа", "программы", "программ")}.${more}`;
        /* ответ лесенкой: строки встают по одной (UI, 220 мс, шаг 50 мс) */
        found.slice(0, 3).forEach((p, i) => {
          const li = document.createElement("li");
          li.style.setProperty("--k", i);
          li.innerHTML = `<a href="#programs"><span class="adm-hits__name"></span><span class="adm-hits__fac"></span></a>`;
          li.querySelector(".adm-hits__name").textContent = p.name;
          li.querySelector(".adm-hits__fac").textContent = p.fac;
          hits.append(li);
        });
        hits.hidden = false;
      });
    });
  }

  /* ───── Калькулятор ЕГЭ ───── */
  function initCalc(data) {
    const form = $("[data-calc]");
    const out = $("[data-calc-out]");
    if (!form || !out || !data) return;
    const S = data.subjects;
    const rows = $$(".calc__row", form);
    const withScale = out.hasAttribute("data-scale");
    let lastTotal = 0;
    const empty = out.innerHTML;

    const setErr = (el, errEl, msg) => {
      if (msg) { el.setAttribute("aria-invalid", "true"); errEl.textContent = msg; errEl.hidden = false; }
      else { el.removeAttribute("aria-invalid"); errEl.textContent = ""; errEl.hidden = true; }
    };

    const read = () => {
      const picked = [];
      let firstBad = null;
      const used = new Set();
      rows.forEach((row) => {
        const sel = $("select", row), inp = $("input", row), err = $(".field__error", row);
        setErr(sel, err, ""); setErr(inp, err, "");
        const raw = inp.value.trim();
        let msg = "";
        if (!sel.value) { msg = "Выберите предмет"; setErr(sel, err, msg); firstBad = firstBad || sel; return; }
        if (used.has(sel.value)) { msg = "Этот предмет уже выбран выше"; setErr(sel, err, msg); firstBad = firstBad || sel; return; }
        if (!/^\d{1,3}$/.test(raw) || +raw > 100) { msg = raw ? "Балл ЕГЭ: целое число от 0 до 100" : "Введите балл от 0 до 100"; setErr(inp, err, msg); firstBad = firstBad || inp; return; }
        used.add(sel.value);
        picked.push({ id: sel.value, score: +raw });
      });
      return { picked, firstBad };
    };

    const render = (picked, bonuses) => {
      const score = Object.fromEntries(picked.map((p) => [p.id, p.score]));
      const matches = [];
      data.programs.forEach((p) => {
        if (!p.req.every((r) => r in score)) return;
        const opts = p.opt.filter((o) => o in score);
        if (p.opt.length && !opts.length) return;
        const best = opts.length ? opts.reduce((a, b) => (score[a] >= score[b] ? a : b)) : null;
        const sum = p.req.reduce((s, r) => s + score[r], 0) + (best ? score[best] : 0);
        matches.push({ p, sum, set: [...p.req, best].filter(Boolean), margin: sum - p.demo });
      });
      matches.sort((a, b) => b.margin - a.margin);
      const total = picked.reduce((s, p) => s + p.score, 0);
      const bonusText = bonuses.length
        ? `+ [N] за достижения: ${bonuses.join(", ")}`
        : "без индивидуальных достижений";

      if (!matches.length) {
        out.innerHTML = `
          <div class="calc-out__sum"><span class="calc-out__total" data-count data-count-dur="900" data-count-from="${lastTotal}">${total}</span><span class="calc-out__label">сумма трёх ЕГЭ<br>${bonusText}</span></div>
          <p class="calc-out__note" style="font-size:1rem;color:var(--c-text)">С таким набором предметов в примере нет программ. Обычно помогает заменить третий предмет: посмотрите перечень вступительных испытаний.</p>
          <div class="calc-out__foot"><a class="btn btn--outline" href="#rules">Перечень испытаний <span class="icon icon--arrow-right" aria-hidden="true"></span></a><a class="btn btn--text" href="#ask">Спросить приёмную комиссию</a></div>`;
        lastTotal = total;
        rescan(out);
        return;
      }
      const top = matches.slice(0, 3);
      const lo = 120, hi = 300;
      const pos = (v) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
      const items = top.map((m, i) => {
        const cls = m.margin >= 8 ? "is-pass" : m.margin >= -10 ? "is-near" : "is-paid";
        const status = m.margin >= 8 ? "Проходите по примеру" : m.margin >= -10 ? "На границе: решат достижения" : "Реальнее платно или по целевому";
        const scale = withScale
          ? `<div class="calc-res__scale" aria-hidden="true" style="--tick:${(pos(m.p.demo) * 100).toFixed(1)}%"><span class="calc-res__tick"></span><span class="calc-res__dot" data-pos="${pos(m.sum).toFixed(4)}"></span></div>`
          : "";
        return `<li class="calc-res__item" data-m="up">
            <p class="calc-res__name">${m.p.name} <span class="calc-res__fac">· ${m.p.fac}</span></p>
            <p class="calc-res__nums"><span>проходные 2025 — <b>[N]</b></span><span>ваш балл — <b data-count data-count-dur="1000">${m.sum}</b></span><span>${m.set.map((s) => S[s].short).join(" + ")}</span></p>
            ${scale}
            <span class="calc-res__status ${cls}">${status}</span>
          </li>`;
      }).join("");
      const more = matches.length - top.length;
      out.innerHTML = `
        <div class="calc-out__sum"><span class="calc-out__total" data-count data-count-dur="900" data-count-from="${lastTotal}">${total}</span><span class="calc-out__label">сумма трёх ЕГЭ<br>${bonusText}</span></div>
        <h3 class="visually-hidden">Программы, куда проходите</h3>
        <ol class="calc-res" role="list" data-m-stagger>${items}</ol>
        <div class="calc-out__foot">
          <a class="btn btn--outline" href="#apply">Подать документы на эти программы <span class="icon icon--arrow-right" aria-hidden="true"></span></a>
          ${more > 0 ? `<a class="btn btn--text" href="#programs">Ещё ${more} ${plural(more, "программа", "программы", "программ")} с этими предметами</a>` : ""}
        </div>
        <p class="calc-out__note">Статус считается по условным порогам примера. Настоящие проходные 2025 года и число бюджетных мест появятся после публикации правил приёма.</p>`;
      lastTotal = total;
      if (withScale) {
        const dots = $$(".calc-res__dot", out);
        const place = () => dots.forEach((d) => { d.style.setProperty("--dot", (d.parentElement.clientWidth * +d.dataset.pos).toFixed(1) + "px"); });
        /* со слоем движения точка стоит в нуле, пока строка не появилась (CSS .m-in), поэтому позицию ставим сразу */
        if (reduce.matches || motionOn()) place();
        else requestAnimationFrame(() => requestAnimationFrame(place));
        if (!out.dataset.resize) { out.dataset.resize = "1"; window.addEventListener("resize", () => $$(".calc-res__dot", out).forEach((d) => { d.style.transition = "none"; d.style.setProperty("--dot", (d.parentElement.clientWidth * +d.dataset.pos).toFixed(1) + "px"); })); }
      }
      rescan(out);
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const { picked, firstBad } = read();
      if (firstBad) { firstBad.focus(); return; }
      const bonuses = $$("input[type=checkbox]:checked", form).map((c) => c.dataset.bonus);
      render(picked, bonuses);
      out.classList.add("has-result");
      if (e.isTrusted && window.matchMedia("(max-width: 1023.98px)").matches) {
        out.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "start" });
      }
    });
    form.addEventListener("reset", () => {
      rows.forEach((row) => { const err = $(".field__error", row); setErr($("select", row), err, ""); setErr($("input", row), err, ""); });
      out.innerHTML = empty; out.classList.remove("has-result");
    });
    $$("input[inputmode=numeric]", form).forEach((inp) => inp.addEventListener("input", () => {
      const clean = inp.value.replace(/\D/g, "").slice(0, 3);
      if (clean !== inp.value) inp.value = clean;
    }));

    if (states().has("calc-result")) {
      const demo = [["rus", 82], ["math", 74], ["inf", 79]];
      rows.forEach((row, i) => { $("select", row).value = demo[i][0]; $("input", row).value = demo[i][1]; });
      const gto = $("input[data-bonus='ГТО']", form); if (gto) gto.checked = true;
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  }

  /* ───── Форма «Задать вопрос» ───── */
  function initAsk() {
    $$("[data-ask]").forEach((form) => {
      const sent = document.getElementById(form.dataset.ask);
      const contact = $("[name=contact]", form), q = $("[name=question]", form), ok = $("[name=consent]", form);
      const err = (el, msg) => {
        const e = document.getElementById(el.getAttribute("aria-describedby").split(" ").find((id) => id.endsWith("-err")));
        if (msg) { el.setAttribute("aria-invalid", "true"); e.textContent = msg; e.hidden = false; }
        else { el.removeAttribute("aria-invalid"); e.textContent = ""; e.hidden = true; }
        return !msg;
      };
      const checkContact = () => {
        const v = contact.value.trim();
        const digits = v.replace(/\D/g, "");
        if (!v) return err(contact, "Оставьте телефон или ник в Telegram, чтобы мы ответили");
        if (v.startsWith("@")) return err(contact, /^@[A-Za-z0-9_]{5,32}$/.test(v) ? "" : "Ник в Telegram: от 5 латинских букв, цифр или _");
        return err(contact, digits.length === 11 && /^[78]/.test(digits) ? "" : "Телефон: 11 цифр, например +7 915 123-45-67");
      };
      const checkQ = () => err(q, q.value.trim().length >= 10 ? "" : q.value.trim() ? "Опишите вопрос чуть подробнее: от 10 символов" : "Напишите вопрос");
      const checkOk = () => err(ok, ok.checked ? "" : "Без согласия мы не сможем ответить");
      contact.addEventListener("blur", () => contact.value.trim() && checkContact());
      [contact, q].forEach((el) => el.addEventListener("input", () => el.hasAttribute("aria-invalid") && (el === contact ? checkContact() : checkQ())));
      ok.addEventListener("change", checkOk);
      const showSent = (focus) => {
        form.hidden = true; sent.hidden = false;
        const who = $("[data-sent-contact]", sent);
        if (who) who.textContent = contact.value.trim() || "указанный контакт";
        if (focus) $(".lead-sent__title", sent).focus();
      };
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const valid = [checkContact(), checkQ(), checkOk()];
        if (valid.includes(false)) { [contact, q, ok][valid.indexOf(false)].focus(); return; }
        showSent(true);
      });
      $("[data-ask-again]", sent)?.addEventListener("click", () => {
        form.reset(); sent.hidden = true; form.hidden = false; contact.focus();
      });
      if (states().has("lead-sent")) { contact.value = "@tver_abiturient"; q.value = "Есть ли общежитие первокурснику из области?"; ok.checked = true; showSent(false); }
    });
  }

  /* ───── Фоновое видео (вариант b): десктоп играет сам, мобильный и reduced-motion — постер и кнопка ───── */
  function initVideo() {
    const box = $("[data-hero-video]");
    if (!box) return;
    const video = $("video", box), btn = $("[data-video-toggle]", box), label = $(".visually-hidden", btn);
    const wide = window.matchMedia("(min-width: 768px)");
    const setUi = (playing) => {
      box.classList.toggle("is-playing", playing);
      label.textContent = playing ? "Пауза фонового видео" : "Воспроизвести фоновое видео";
    };
    const load = () => {
      if (video.dataset.loaded) return;
      video.src = wide.matches ? video.dataset.srcWide : video.dataset.srcNarrow;
      video.dataset.loaded = "1";
    };
    const play = () => { load(); video.play().then(() => setUi(true)).catch(() => setUi(false)); };
    btn.addEventListener("click", () => (video.paused ? play() : (video.pause(), setUi(false))));
    video.addEventListener("pause", () => setUi(false));
    video.addEventListener("playing", () => setUi(true));
    setUi(false);
    if (wide.matches && !reduce.matches && !states().size) play();
    reduce.addEventListener?.("change", () => { if (reduce.matches) video.pause(); });
  }

  /* ───── Маршрут (вариант c): линия дорисовывается прокруткой, шаги зажигаются, когда линия до них дошла ─────
     Первый экран: при загрузке линия сама доходит до шага 2 («Сейчас» — первые два шага можно сделать сегодня),
     дальше её ведёт прокрутка (в обе стороны). Один rAF на страницу, на кадр читается один прямоугольник.
     Без слоя движения (reduced-motion, состояния для скриншотов) — финальный рисунок из CSS. */
  function initRoute() {
    const route = $("[data-route]");
    if (!route || !motionOn() || states().size) return;
    const path = $(".c-route__path", route);
    const list = $(".c-route__list", route);
    const steps = $$(".c-route__step", route);
    if (!path || !steps.length) return;
    const wide = window.matchMedia("(min-width: 768px)");
    const clamp = (v) => Math.max(0, Math.min(1, v));
    let fr = [], offs = [], intro = 0, drawn = -1, raf = 0;

    const measure = () => {
      const L = path.getTotalLength();
      fr = steps.map((st) => {                       // доля длины кривой в узле x (x монотонен — бинарный поиск)
        const x = +st.dataset.x;
        let lo = 0, hi = L;
        for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (path.getPointAtLength(mid).x < x) lo = mid; else hi = mid; }
        return lo / L;
      });
      offs = steps.map((st) => st.offsetTop);
    };

    const light = (st, on) => {
      if (st.classList.contains("is-lit") === on) return;
      st.classList.toggle("is-lit", on);
      const num = $(".c-route__num", st);
      if (on && num && !num.dataset.ticked) {          // номер шага — короткое табло 0 → n
        num.dataset.ticked = "1";
        const n = +num.textContent; let v = 0;
        const t = setInterval(() => { num.textContent = String(v); if (v++ >= n) clearInterval(t); }, 55);
      }
    };

    const frame = () => {
      raf = 0;
      const vh = window.innerHeight;
      const r = route.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return;
      if (wide.matches) {
        const p = clamp((vh * 0.86 - r.top) / (vh * 0.56));
        const d = Math.max(intro, p);
        if (Math.abs(d - drawn) > 0.0005) { drawn = d; path.style.strokeDashoffset = (1 - d).toFixed(4); }
        steps.forEach((st, i) => light(st, d >= fr[i] - 0.004));
      } else {
        const pen = vh * 0.7 - (r.top + (list.offsetTop || 0));
        steps.forEach((st, i) => {
          const top = offs[i] + 14, next = i + 1 < offs.length ? offs[i + 1] + 14 : top;
          st.style.setProperty("--seg", next > top ? clamp((pen - top) / (next - top)).toFixed(3) : "0");
          light(st, pen >= offs[i] + 6);
        });
      }
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

    measure();
    route.classList.add("is-live");
    frame();
    window.addEventListener("scroll", kick, { passive: true });
    const remeasure = () => { measure(); drawn = -1; kick(); };
    window.addEventListener("resize", remeasure, { passive: true });
    window.addEventListener("load", remeasure, { once: true });
    document.fonts?.ready.then(remeasure);
    wide.addEventListener?.("change", () => { steps.forEach((st) => st.style.removeProperty("--seg")); drawn = -1; kick(); });

    /* вступление: 1.1 с --ease-in-out до шага 2, после заголовка */
    const target = fr[1] || 0.4, dur = 1100, delay = 650;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const t0 = performance.now() + delay;
    const tick = (now) => {
      const t = clamp((now - t0) / dur);
      intro = target * ease(t);
      frame();
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    reduce.addEventListener?.("change", () => { if (reduce.matches) { route.classList.remove("is-live"); path.style.strokeDashoffset = ""; } });
  }

  function init() {
    let data = null;
    try { data = JSON.parse($("#programs-demo").textContent); } catch (e) { data = null; }
    watchHeader();
    initSubnav();
    initSticky();
    if (data) { initSearch(data.programs); initCalc(data); }
    initAsk();
    initVideo();
  }

  initRoute();
  if (window.TVSU && window.TVSU.ready) window.TVSU.ready.then(init);
  else document.addEventListener("partials:ready", init, { once: true });
})();
