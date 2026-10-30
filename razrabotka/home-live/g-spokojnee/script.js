/* home-live/g-spokojnee: видео по кнопке и демо-форма вопроса. */
(function () {
  "use strict";

  document.querySelectorAll("[data-video-play]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var box = btn.parentElement;
      var v = document.createElement("video");
      v.src = btn.dataset.src;
      v.controls = true;
      v.playsInline = true;
      v.autoplay = true;
      var img = box.querySelector("img");
      if (img) v.poster = img.src;
      box.replaceChildren(v);
      v.focus();
    });
  });

  var form = document.querySelector("[data-form]");
  var done = document.querySelector("[data-form-done]");
  var again = document.querySelector("[data-form-again]");
  if (!form || !done) return;

  function sent() {
    form.hidden = true;
    done.hidden = false;
    done.focus();
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    sent();
  });
  again.addEventListener("click", function () {
    form.reset();
    done.hidden = true;
    form.hidden = false;
    form.querySelector("input, textarea").focus();
  });
  if (new URLSearchParams(location.search).get("state") === "sent") sent();
})();
