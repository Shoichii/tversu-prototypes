/* Приёмка (CC4) — общее поведение вариантов a/b/c: данные программ, калькулятор ЕГЭ, лид-форма,
   липкая панель «Подать документы», подменю-скроллспай, чат, счёт дней.
   Файл одинаковый в a, b, c (remote-check синкает только папку варианта) — кандидат в system.
   Данные programs.json — ДЕМОНСТРАЦИОННЫЕ (см. NOTES.md). */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const params = new URLSearchParams(location.search);
  const states = new Set((params.get("state") || "").split(",").map((s) => s.trim()).filter(Boolean));

  const ADM = (window.ADM = window.ADM || {});
  ADM.states = states;
  ADM.reduce = reduce;

  /* ───── Данные ───── */
  ADM.data = fetch(new URL("programs.json", document.currentScript?.src || location.href))
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .catch(() => ({ subjects: {}, programs: [], failed: true }));

  ADM.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  ADM.plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  /* ───── Дни до даты. ?today=YYYY-MM-DD фиксирует «сегодня» для скриншотов ───── */
  ADM.today = () => {
    const t = ADM.todayOverride || params.get("today");
    const d = t ? new Date(t + "T00:00:00") : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };
  ADM.daysUntil = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return Math.round((d - ADM.today()) / 86400000);
  };

  /* Докрутка числа: tabular-nums, ease-out, без мигания; reduced-motion — сразу финал */
  ADM.countTo = (el, to, { duration = 700 } = {}) => {
    const fmt = (v) => Math.round(v).toLocaleString("ru-RU");
    if (reduce.matches || !Number.isFinite(to)) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const ease = (x) => 1 - Math.pow(1 - x, 4);
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      el.textContent = fmt(to * ease(p));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /* ───── Калькулятор ЕГЭ ─────
     <form data-calc> … <div data-calc-row><select data-calc-subject><input data-calc-score></div> ×3
     <input type=checkbox data-calc-ach> … <div data-calc-result aria-live="polite"></div> */
  function matchPrograms(data, picked) {
    const has = new Map(picked.map((p) => [p.subject, p.score]));
    const fit = [], near = [];
    for (const p of data.programs) {
      const missingReq = p.required.filter((s) => !has.has(s));
      const choiceHit = p.choice.filter((s) => has.has(s));
      const choiceOk = p.choice.length === 0 || choiceHit.length > 0;
      if (!missingReq.length && choiceOk) {
        const best = choiceHit.length ? Math.max(...choiceHit.map((s) => has.get(s))) : 0;
        const bestSubj = choiceHit.find((s) => has.get(s) === best);
        const used = [...p.required, ...(bestSubj ? [bestSubj] : [])];
        const sum = used.reduce((a, s) => a + has.get(s), 0);
        fit.push({ p, sum, max: used.length * 100, used });
      } else {
        const need = [...missingReq, ...(choiceOk ? [] : [p.choice[0]])];
        if (need.length === 1) near.push({ p, need: need[0] });
      }
    }
    fit.sort((a, b) => b.sum / b.max - a.sum / a.max || a.p.name.localeCompare(b.p.name, "ru"));
    return { fit, near };
  }
  ADM.matchPrograms = matchPrograms;

  ADM.initCalc = async function (form, { limit = 5, onPick } = {}) {
    if (!form) return;
    const data = await ADM.data;
    const rows = [...form.querySelectorAll("[data-calc-row]")];
    const out = form.querySelector("[data-calc-result]") || document.querySelector(form.dataset.calcResult);
    const achs = [...form.querySelectorAll("[data-calc-ach]")];
    const errBox = form.querySelector("[data-calc-error]");

    // варианты предметов
    rows.forEach((row, i) => {
      const sel = row.querySelector("[data-calc-subject]");
      if (sel && sel.options.length <= 1) {
        const def = sel.dataset.default || "";
        Object.entries(data.subjects).forEach(([k, v]) => {
          const o = new Option(v, k, false, k === def);
          sel.add(o);
        });
      }
      const inp = row.querySelector("[data-calc-score]");
      inp?.addEventListener("input", () => {
        inp.value = inp.value.replace(/\D/g, "").slice(0, 3);
        clearRowError(row);
      });
      sel?.addEventListener("change", () => clearRowError(row));
    });

    function clearRowError(row) {
      row.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
      const e = row.querySelector(".calc-row__error");
      if (e) e.textContent = "";
    }
    function setRowError(row, el, msg) {
      el.setAttribute("aria-invalid", "true");
      const e = row.querySelector(".calc-row__error");
      if (e) e.textContent = msg;
    }

    function read() {
      const picked = [];
      let ok = true;
      const seen = new Set();
      rows.forEach((row) => {
        clearRowError(row);
        const sel = row.querySelector("[data-calc-subject]");
        const inp = row.querySelector("[data-calc-score]");
        const subject = sel.value;
        const raw = inp.value.trim();
        if (!subject && !raw) return;
        if (!subject) { setRowError(row, sel, "Выберите предмет"); ok = false; return; }
        if (seen.has(subject)) { setRowError(row, sel, "Этот предмет уже выбран"); ok = false; return; }
        if (raw === "") { setRowError(row, inp, "Введите балл от 0 до 100"); ok = false; return; }
        const score = Number(raw);
        if (!Number.isInteger(score) || score < 0 || score > 100) { setRowError(row, inp, "Балл ЕГЭ: от 0 до 100"); ok = false; return; }
        seen.add(subject);
        picked.push({ subject, score });
      });
      if (ok && picked.length < 2) {
        ok = false;
        if (errBox) errBox.textContent = "Заполните хотя бы два предмета: русский язык и профильный.";
      } else if (errBox) errBox.textContent = "";
      return ok ? picked : null;
    }

    function render(picked) {
      const { fit, near } = matchPrograms(data, picked);
      const achCount = achs.filter((a) => a.checked).length;
      const total = picked.reduce((a, p) => a + p.score, 0);
      const E = ADM.esc;
      const names = (list) => list.map((s) => E(data.subjects[s] || s)).join(" + ");
      let html = `<div class="calc-out">`;
      html += `<div class="calc-out__head">
        <p class="calc-out__title">${fit.length
          ? `${ADM.plural(fit.length, "Подходит", "Подходят", "Подходят")} ${fit.length} ${ADM.plural(fit.length, "направление", "направления", "направлений")} по вашему набору`
          : "По этому набору предметов направлений нет"}</p>
        <p class="calc-out__meta">Сумма ЕГЭ: <b class="num" data-calc-sum="${total}">${total}</b>${achCount
          ? ` · отмечено достижений: ${achCount}, добавят до 10 баллов при подаче`
          : ""}</p>
      </div>`;
      if (fit.length) {
        html += `<ol class="calc-out__list" role="list">`;
        fit.slice(0, limit).forEach(({ p, sum, max, used }, i) => {
          html += `<li class="calc-prog" style="--i:${i}">
            <div class="calc-prog__main">
              <span class="calc-prog__code num">${E(p.code)}</span>
              <a class="calc-prog__name" href="#" data-pick="${E(p.name)}">${E(p.name)}</a>
              <span class="calc-prog__fac">${E(p.faculty)}</span>
              <span class="calc-prog__subj">${names(used)}${p.extra ? ` + ${E(p.extra)}` : ""}</span>
            </div>
            <dl class="calc-prog__nums">
              <div><dt>ваш балл</dt><dd class="num"><span data-calc-sum="${sum}">${sum}</span><small>/${max}</small><span class="calc-prog__bar" style="--v:${(sum / max).toFixed(3)}" aria-hidden="true"></span></dd></div>
              <div><dt>проходной 2025</dt><dd class="num">[N]</dd></div>
              <div><dt>бюджетных мест</dt><dd class="num">${p.budget ? "[N]" : "платно"}</dd></div>
            </dl>
          </li>`;
        });
        html += `</ol>`;
        if (fit.length > limit) html += `<p class="calc-out__more">И ещё ${fit.length - limit} в каталоге программ. <a href="#">Смотреть все</a></p>`;
      }
      if (near.length) {
        const bySubj = {};
        near.forEach(({ need }) => (bySubj[need] = (bySubj[need] || 0) + 1));
        const tips = Object.entries(bySubj).sort((a, b) => b[1] - a[1]).slice(0, 2)
          .map(([s, n]) => `<b>${E(data.subjects[s])}</b> откроет ещё ${n} ${ADM.plural(n, "направление", "направления", "направлений")}`);
        html += `<p class="calc-out__near">${tips.join("; ")}.</p>`;
      }
      html += `<p class="calc-out__note">Проходные баллы 2025: [N], появятся после публикации итогов кампании. Список направлений демонстрационный.</p></div>`;
      out.innerHTML = html;
      out.hidden = false;
      // результат «доезжает»: суммы считаются от нуля лесенкой вслед за строками, шкалы заполняются в CSS
      if (!reduce.matches) {
        out.querySelectorAll("[data-calc-sum]").forEach((el, i) => {
          const to = Number(el.dataset.calcSum);
          el.textContent = "0";
          setTimeout(() => ADM.countTo(el, to, { duration: 800 }), Math.max(0, i - 1) * 40 + 80);
        });
      }
      out.querySelectorAll("[data-pick]").forEach((a) =>
        a.addEventListener("click", (e) => { if (onPick) { e.preventDefault(); onPick(a.dataset.pick); } })
      );
      form.classList.add("has-result");
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const picked = read();
      if (!picked) {
        const bad = form.querySelector('[aria-invalid="true"]');
        bad?.focus();
        return;
      }
      render(picked);
      if (e.submitter) out.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "nearest" });
    });

    ADM.fillCalc = (values, achIdx = []) => {
      values.forEach(([s, v], i) => {
        const row = rows[i];
        if (!row) return;
        row.querySelector("[data-calc-subject]").value = s;
        row.querySelector("[data-calc-score]").value = v;
      });
      achIdx.forEach((i) => achs[i] && (achs[i].checked = true));
      form.requestSubmit();
    };
    if (states.has("calc-result")) ADM.fillCalc([["rus", 82], ["math", 74], ["inf", 88]], [0]);
  };

  /* ───── Лид-форма «Задать вопрос» ─────
     <form data-lead> <input name=contact> <textarea|input name=question> <div data-lead-done hidden> */
  ADM.initLead = function (form) {
    if (!form) return;
    const contact = form.elements.contact;
    const question = form.elements.question;
    const done = form.querySelector("[data-lead-done]");
    const body = form.querySelector("[data-lead-body]");
    const setErr = (el, msg) => {
      const err = document.getElementById(el.getAttribute("aria-describedby")?.split(" ").find((id) => id.endsWith("-err")));
      if (msg) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
      if (err) { err.textContent = msg || ""; err.hidden = !msg; }
    };
    const checkContact = () => {
      const v = contact.value.trim();
      const digits = v.replace(/\D/g, "");
      if (!v) return "Укажите телефон или ник в Telegram, чтобы мы ответили";
      if (v.startsWith("@")) return /^@[A-Za-z0-9_]{5,32}$/.test(v) ? "" : "Ник в Telegram: @ и от 5 латинских букв, цифр или _";
      if (v.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Проверьте адрес почты";
      return digits.length === 11 && /^[78]/.test(digits) ? "" : "Номер из 11 цифр, например +7 900 000-00-00";
    };
    const checkQuestion = () => (!question || question.value.trim().length >= 5 ? "" : "Напишите вопрос хотя бы в пару слов");
    contact.addEventListener("blur", () => contact.value && setErr(contact, checkContact()));
    contact.addEventListener("input", () => contact.hasAttribute("aria-invalid") && setErr(contact, checkContact()));
    question?.addEventListener("input", () => question.hasAttribute("aria-invalid") && setErr(question, checkQuestion()));
    const showDone = () => {
      done?.querySelectorAll(".lead-done__title path").forEach((p) => p.setAttribute("pathLength", "1"));
      if (body) body.hidden = true;
      if (done) { done.hidden = false; done.focus({ preventScroll: true }); }
      form.classList.add("is-sent");
    };
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const a = checkContact(), b = checkQuestion();
      setErr(contact, a);
      if (question) setErr(question, b);
      if (a) { contact.focus(); return; }
      if (b) { question.focus(); return; }
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      btn.dataset.label = btn.textContent;
      btn.textContent = "Отправляем…";
      setTimeout(showDone, 600);
    });
    form.querySelector("[data-lead-again]")?.addEventListener("click", () => {
      form.reset();
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = false;
      if (btn.dataset.label) btn.textContent = btn.dataset.label;
      done.hidden = true; body.hidden = false; form.classList.remove("is-sent");
      contact.focus();
    });
    if (states.has("lead-sent")) {
      contact.value = "@tver_abiturient";
      if (question) question.value = "Есть ли общежитие для первого курса?";
      showDone();
    }
  };

  /* ───── Липкая панель «Подать документы» (мобильный) ─────
     прячется, когда видна любая [data-primary-cta] или подвал */
  ADM.initStickyBar = function (bar) {
    if (!bar || !("IntersectionObserver" in window)) return;
    const seen = new Set();
    const targets = [...document.querySelectorAll("[data-primary-cta]"), document.querySelector(".site-footer")].filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => (en.isIntersecting ? seen.add(en.target) : seen.delete(en.target)));
      bar.classList.toggle("is-hidden", seen.size > 0);
      bar.inert = seen.size > 0;
    }, { threshold: 0.01 });
    targets.forEach((t) => io.observe(t));
  };

  /* ───── Подменю раздела: скроллспай + подкрутка ленты ───── */
  ADM.initSubnav = function (nav) {
    if (!nav) return;
    const links = [...nav.querySelectorAll('a[href^="#"]')];
    const map = new Map();
    links.forEach((a) => { const h = a.getAttribute("href"); const s = h.length > 1 && document.getElementById(h.slice(1)); if (s) map.set(s, a); });
    let current = null;
    const setCurrent = (a) => {
      if (a === current) return;
      current?.removeAttribute("aria-current");
      current = a;
      if (!a) return;
      a.setAttribute("aria-current", "true");
      const track = a.parentElement.closest(".subnav__track");
      if (track && track.scrollWidth > track.clientWidth) {
        const left = a.offsetLeft - track.clientWidth / 2 + a.offsetWidth / 2;
        track.scrollTo({ left, behavior: reduce.matches ? "auto" : "smooth" });
      }
    };
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setCurrent(map.get(vis[0].target));
    }, { rootMargin: "-30% 0px -60% 0px" });
    map.forEach((_, s) => io.observe(s));
    // липкое состояние — тонкая линия снизу
    const sentinel = document.createElement("div");
    sentinel.className = "subnav__sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    nav.before(sentinel);
    new IntersectionObserver(([e]) => nav.classList.toggle("is-stuck", !e.isIntersecting && e.boundingClientRect.top < 0))
      .observe(sentinel);
  };

  /* ───── Плавающая кнопка чата ───── */
  ADM.initChat = function (root) {
    if (!root) return;
    const btn = root.querySelector("[data-chat-toggle]");
    const panel = root.querySelector("[data-chat-panel]");
    const set = (open, focus = true) => {
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      root.classList.toggle("is-open", open);
      if (open && focus) panel.querySelector("a, button")?.focus();
      if (!open && focus) btn.focus();
    };
    btn.addEventListener("click", () => set(panel.hidden));
    panel.querySelector("[data-chat-close]")?.addEventListener("click", () => set(false));
    panel.addEventListener("click", (e) => { if (e.target.closest("a[href^='#']")) set(false, false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) set(false); });
    if (states.has("chat-open")) set(true, false);
  };

  /* ───── Появление при прокрутке — через общий слой system/motion.js (без своего IntersectionObserver) ─────
     Узлу ставится data-m (по умолчанию "up"), дальше им управляет TVSU_MOTION; без слоя — сразу виден. */
  ADM.reveal = function (els, kind = "up") {
    const M = window.TVSU_MOTION;
    els.forEach((el) => { if (!el.dataset.m) el.dataset.m = kind; });
    if (M) M.scan(); else els.forEach((el) => el.classList.add("m-in"));
  };
})();
