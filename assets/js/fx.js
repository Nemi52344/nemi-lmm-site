/* Reveal-on-scroll + in-view video playback.
   Uses rAF-throttled scroll checks (no IntersectionObserver) so it behaves
   identically in every browser. Respects prefers-reduced-motion. */
(function () {
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var els = Array.prototype.slice.call(document.querySelectorAll(".rv, .rv-l, .rv-r"));
  var vids = Array.prototype.slice.call(document.querySelectorAll("video[data-flow]"));

  if (reduced) {
    els.forEach(function (e) { e.classList.add("shown"); });
    els = [];
  }

  function inView(el, margin) {
    var r = el.getBoundingClientRect();
    var h = window.innerHeight || document.documentElement.clientHeight;
    return r.top < h - (margin || 0) && r.bottom > (margin || 0);
  }

  function check() {
    for (var i = els.length - 1; i >= 0; i--) {
      var el = els[i];
      if (inView(el, 60)) {
        el.classList.add("shown");
        els.splice(i, 1);
      }
    }
    for (var j = 0; j < vids.length; j++) {
      var v = vids[j];
      if (inView(v, -120)) {
        if (v.paused) v.play().catch(function () {});
      } else if (!v.paused) {
        v.pause();
      }
    }
  }

  /* Case-study card deck: one card in view; scrolling slides the next card
     up over it while viewed cards tuck behind as peeking layers on top. */
  var deckWrap = document.querySelector(".deckwrap");
  var deckCards = deckWrap
    ? Array.prototype.slice.call(deckWrap.querySelectorAll(".deck-card"))
    : [];
  function stackFx() {
    if (!deckCards.length || window.innerWidth <= 900) return;
    var rect = deckWrap.getBoundingClientRect();
    var total = deckWrap.offsetHeight - window.innerHeight;
    var p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
    var seg = p * (deckCards.length - 1);
    for (var i = 0; i < deckCards.length; i++) {
      var c = deckCards[i];
      var d = seg - i;
      if (d >= 0) {
        /* Active or already viewed: tuck upward behind the incoming card. */
        var k = Math.min(d, 2);
        c.style.transform = "translateY(" + (-26 * k) + "px) scale(" + (1 - 0.035 * k) + ")";
      } else {
        /* Future: waits below the frame, slides up during its segment. */
        c.style.transform = "translateY(" + (Math.min(-d, 1) * 112) + "%)";
      }
      c.style.zIndex = 10 + i;
    }
  }

  /* Sticky dark navbar once the page is scrolled past the hero top. */
  var navEl = document.querySelector(".nav");

  var last = 0, queued = false;
  function onScroll() {
    if (navEl) navEl.classList.toggle("nav--stuck", window.scrollY > 120);
    stackFx();
    var now = Date.now();
    if (now - last > 80) {
      last = now;
      check();
    } else if (!queued) {
      queued = true;
      setTimeout(function () { queued = false; last = Date.now(); check(); }, 90);
    }
  }

  /* Hero headline typing effect: types the plain part, then the accent part,
     with a blinking cursor. Shows instantly under reduced motion. */
  var typefx = document.querySelector(".typefx");
  if (typefx) {
    var typeT1 = typefx.querySelector(".typefx__t1");
    var typeT2 = typefx.querySelector(".typefx__t2");
    var typeS1 = "NEMI LMM for ";
    var typeS2 = "Physical AI";
    if (reduced) {
      typeT1.textContent = typeS1;
      typeT2.textContent = typeS2;
    } else {
      var typeI = 0, typeTotal = typeS1.length + typeS2.length;
      setTimeout(function typeTick() {
        typeI++;
        if (typeI <= typeS1.length) typeT1.textContent = typeS1.slice(0, typeI);
        else typeT2.textContent = typeS2.slice(0, typeI - typeS1.length);
        if (typeI < typeTotal) setTimeout(typeTick, 60 + Math.random() * 60);
      }, 450);
    }
  }

  /* Months-to-hours loop: the active highlight travels 01 -> 08 in process
     order and wraps back to 01, so the loop visibly closes. */
  var loopSteps = Array.prototype.slice.call(document.querySelectorAll(".loop-step"));
  if (loopSteps.length && !reduced) {
    loopSteps.sort(function (a, b) {
      return +a.querySelector(".loop-step__cap b").textContent -
             +b.querySelector(".loop-step__cap b").textContent;
    });
    var loopIdx = 0;
    loopSteps[0].classList.add("active");
    setInterval(function () {
      loopSteps[loopIdx].classList.remove("active");
      loopIdx = (loopIdx + 1) % loopSteps.length;
      loopSteps[loopIdx].classList.add("active");
    }, 1300);
  }

  /* Customer marquee spotlight: as each logo crosses the center of its row,
     it lights up in full colour — no hover needed. */
  var marquees = Array.prototype.slice.call(document.querySelectorAll(".marquee"));
  if (marquees.length && !reduced) {
    setInterval(function () {
      marquees.forEach(function (m) {
        var mid = m.getBoundingClientRect();
        var center = mid.left + mid.width / 2;
        var chips = m.querySelectorAll(".chip--logo");
        for (var i = 0; i < chips.length; i++) {
          var r = chips[i].getBoundingClientRect();
          var lit = Math.abs((r.left + r.width / 2) - center) < r.width * 0.6;
          chips[i].classList.toggle("lit", lit);
        }
      });
    }, 200);
  }

  /* Expanding industry panels: click (or Enter) focuses one panel open. */
  var expPanels = Array.prototype.slice.call(document.querySelectorAll(".exp-panel"));
  expPanels.forEach(function (p) {
    function activate() {
      expPanels.forEach(function (q) { q.classList.remove("active"); });
      p.classList.add("active");
    }
    p.addEventListener("click", activate);
    p.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  check();
  stackFx();
  /* Catch late layout (fonts, media) shortly after load. */
  setTimeout(check, 400);
  setTimeout(check, 1200);

  /* Pinned intro statement: title shrinks to the top, lines run in from the
     right, meta + CTA fade in once the lines land. Desktop only. */
  var pin = document.querySelector(".pinwrap");
  if (pin && window.matchMedia("(min-width: 901px)").matches && !reduced) {
    var pinTitle = pin.querySelector(".pin__title");
    var pinLines = pin.querySelector(".pin__lines");
    var pinEnds = pin.querySelectorAll(".pin__meta, .pin__cta");
    var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
    var updPin = function () {
      var rect = pin.getBoundingClientRect();
      var total = pin.offsetHeight - window.innerHeight;
      var p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      var tT = easeOut(Math.min(1, p / 0.38));
      var xT = easeOut(Math.min(1, Math.max(0, (p - 0.4) / 0.5)));
      pinTitle.style.top = (50 - 32 * tT) + "%";
      pinTitle.style.transform = "translateY(-50%) scale(" + (1 - 0.52 * tT) + ")";
      pinLines.style.transform = "translateX(" + ((1 - xT) * 100) + "vw)";
      pinLines.style.opacity = xT > 0.02 ? 1 : 0;
      pinTitle.classList.toggle("hl-on", tT >= 0.99);
      pinLines.classList.toggle("hl-on", xT >= 0.99);
      for (var k = 0; k < pinEnds.length; k++) pinEnds[k].style.opacity = xT >= 1 ? 1 : 0;
    };
    window.addEventListener("scroll", updPin, { passive: true });
    window.addEventListener("resize", updPin, { passive: true });
    updPin();
  }
})();
