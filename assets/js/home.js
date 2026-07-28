/* NEMI home — chrome + interactions (adapted from the reference build) */

(function () {
  var nav =
    '<header class="nav"><div class="wrap">' +
    '<a class="nav__logo" href="index.html"><img src="assets/img/logo-dark.png" alt="NEMI"></a>' +
    '<nav class="nav__links" id="menu">' +
    '<a href="index.html" class="active">Home</a>' +
    '<a href="about.html">About Us</a>' +
    '<a href="offerings.html">Offerings</a>' +
    '<a href="blog.html">Blog</a>' +
    '<a href="careers.html">Careers</a>' +
    '<a href="contact.html" class="nav__cta">Contact</a>' +
    '</nav>' +
    '<button class="nav__burger" aria-label="Menu"><span></span><span></span><span></span></button>' +
    '</div></header>';

  var year = new Date().getFullYear();

  var footer =
    '<footer><div class="container">' +
    '<div class="foot-grid">' +
    '<div>' +
    '<div class="foot-brand">NEMI<span>.</span></div>' +
    '<p class="foot-tag">The NEMI LMM for Physical AI &mdash; the Large Manufacturing Model, AI that runs our manufacturing.</p>' +
    '<div class="foot-certs"><span class="foot-cert">AS9100D:2016</span><span class="foot-cert">ISO 9001:2015</span></div>' +
    '</div>' +
    '<div><h4>NEMI</h4><ul>' +
    '<li><a href="index.html">Home</a></li>' +
    '<li><a href="about.html">About Us</a></li>' +
    '<li><a href="offerings.html">Offerings</a></li>' +
    '<li><a href="blog.html">Blog</a></li>' +
    '<li><a href="careers.html">Careers</a></li>' +
    '</ul></div>' +
    '<div><h4>Platform</h4><ul>' +
    '<li><a href="offerings.html">Anvil &middot; Engineer</a></li>' +
    '<li><a href="offerings.html">Orion &middot; Manufacture</a></li>' +
    '<li><a href="offerings.html">Atlas &middot; Improve</a></li>' +
    '</ul></div>' +
    '<div><h4>Contact</h4><ul>' +
    '<li><a href="mailto:info@nemilmm.com">info@nemilmm.com</a></li>' +
    '<li><a href="tel:+910000000000">+91 00000 00000</a></li>' +
    '</ul></div>' +
    '</div>' +
    '<div class="foot-base">' +
    '<span>&copy; ' + year + ' NEMI AI. All rights reserved.</span>' +
    '<span>Stafford, Texas &middot; Coimbatore, India</span>' +
    '<span><a href="mailto:info@nemilmm.com">info@nemilmm.com</a></span>' +
    '</div>' +
    '</div></footer>';

  document.body.insertAdjacentHTML('afterbegin', nav);
  document.body.insertAdjacentHTML('beforeend', footer);

  /* hero H1 typewriter: "NEMI LMM / for Physical AI" types in on load */
  (function () {
    var h1 = document.querySelector('.hero h1.display');
    if (!h1) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var full = 'NEMI LMM\nfor Physical AI';
    h1.style.minHeight = h1.offsetHeight + 'px';   /* reserve height, no reflow */
    h1.innerHTML = '<span class="hero-type"></span>';
    var span = h1.querySelector('.hero-type');
    h1.classList.add('typing');
    var i = 0;
    (function step() {
      i++;
      span.innerHTML = full.slice(0, i).replace(/\n/g, '<br>');
      if (i < full.length) { setTimeout(step, 68); }
      else { setTimeout(function () { h1.classList.remove('typing'); }, 1600); }
    })();
  })();

  /* mobile menu */
  var burger = document.querySelector('.nav__burger');
  var menu = document.getElementById('menu');
  if (burger && menu) {
    burger.addEventListener('click', function () { menu.classList.toggle('open'); });
  }

  /* floating glass bar once scrolled past the hero top */
  var navEl = document.querySelector('.nav');
  window.addEventListener('scroll', function () {
    if (navEl) navEl.classList.toggle('nav--stuck', window.scrollY > 120);
  }, { passive: true });

  /* scroll reveal */
  function revealAll() {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    revealAll();
  }

  /* thesis card deck: scroll advances the deck; viewed cards tuck up behind
     the incoming one as peeking layers (Navigator-style stack) */
  /* typewriter: "what LLMs did for software." types on when its card arrives */
  var typeEm = document.querySelector('.type-fx');
  var typeText = typeEm ? typeEm.textContent : '';
  var typeStarted = false;
  if (typeEm) typeEm.textContent = '';
  var startTyping = function () {
    if (typeStarted || !typeEm) return;
    typeStarted = true;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      typeEm.textContent = typeText;
      return;
    }
    typeEm.classList.add('typing');
    var i = 0;
    var iv = setInterval(function () {
      i++;
      typeEm.textContent = typeText.slice(0, i);
      if (i >= typeText.length) {
        clearInterval(iv);
        setTimeout(function () { typeEm.classList.remove('typing'); }, 2400);
      }
    }, 55);
  };

  var deckWrap = document.querySelector('.thesis-deckwrap');
  var deckCards = deckWrap ? Array.prototype.slice.call(deckWrap.querySelectorAll('.tcard')) : [];
  var deckCount = deckWrap ? deckWrap.querySelector('.thesis-count') : null;
  if (deckCards.length && window.innerWidth > 860) {
    var deckTick = function () {
      var rect = deckWrap.getBoundingClientRect();
      var total = deckWrap.offsetHeight - window.innerHeight;
      var p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      var seg = p * (deckCards.length - 1);
      if (seg > 1.35) startTyping();          /* card 03 sliding in — start typing */
      for (var i = 0; i < deckCards.length; i++) {
        var d = seg - i;
        var c = deckCards[i];
        if (d >= 0) {
          var k = Math.min(d, 2);
          c.style.transform = 'translateY(' + (-24 * k) + 'px) scale(' + (1 - 0.035 * k) + ')';
          c.style.filter = 'brightness(' + (1 - 0.16 * Math.min(d, 1)) + ')';
        } else {
          c.style.transform = 'translateY(' + (Math.min(-d, 1) * 112) + '%)';
          c.style.filter = 'none';
        }
        c.style.zIndex = 10 + i;
      }
      if (deckCount) {
        var active = Math.min(deckCards.length, Math.round(seg) + 1);
        deckCount.textContent = '[0' + active + '] / 0' + deckCards.length;
      }
    };
    window.addEventListener('scroll', deckTick, { passive: true });
    deckTick();
  }
  /* no deck ticker (mobile) — type when the text scrolls into view */
  if (typeEm && !(deckCards.length && window.innerWidth > 860)) {
    if ('IntersectionObserver' in window) {
      var tio = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { startTyping(); tio.disconnect(); }
      }, { threshold: 0.4 });
      tio.observe(typeEm);
    } else {
      startTyping();
    }
  }

  /* suites showcase: heading first, then per suite the screenshot sweeps in
     from the right (60% of the page) and the left info rises in; scroll
     advances through all four suites */
  var suitesWrap = document.querySelector('.suites-wrap');
  if (suitesWrap && window.innerWidth > 860) {
    var sFigs = Array.prototype.slice.call(suitesWrap.querySelectorAll('.suite-media figure'));
    var sInfos = Array.prototype.slice.call(suitesWrap.querySelectorAll('.suite-info'));
    var sIntro = suitesWrap.querySelector('.suites-intro');
    var suitesTick = function () {
      var rect = suitesWrap.getBoundingClientRect();
      var total = suitesWrap.offsetHeight - window.innerHeight;
      var p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      var vw = window.innerWidth, vh = window.innerHeight;
      /* 0) the heading owns the black screen first and fades away COMPLETELY
            (done by p=0.11) before any image is allowed to enter (p=0.16) */
      var fade = Math.min(1, Math.max(0, (p - 0.04) / 0.07));
      if (sIntro) {
        sIntro.style.opacity = String(1 - fade);
        sIntro.style.transform = 'translateY(' + (-48 * fade) + 'px) scale(' + (1 - 0.04 * fade) + ')';
      }
      var q = Math.min(1, Math.max(0, (p - 0.16) / 0.84));
      var pos = q * sFigs.length;                         /* 0..4 across suites */
      for (var i = 0; i < sFigs.length; i++) {
        var t = pos - i;
        /* 1) image sweeps in from the right at 60% width, tall */
        var im = Math.min(1, Math.max(0, t / 0.35));
        var e = 1 - Math.pow(1 - im, 3);
        /* exit: the outgoing image fades and drifts left as the next arrives —
           no ghost edges left behind the incoming screenshot */
        var u = Math.min(1, Math.max(0, (t - 1) / 0.3));
        sFigs[i].style.transform = 'translateX(' + ((1 - e) * 110 - 6 * u) + '%)';
        sFigs[i].style.opacity = String(1 - u);
        /* 2) then grows leftward to 75% of the page — never the full width.
              height follows the screenshot's own 16:9 ratio so the full image
              is always visible (no crop), capped to the viewport */
        var g = Math.min(1, Math.max(0, (t - 0.35) / 0.3));
        var ge = g * g * (3 - 2 * g);                     /* smoothstep */
        var AR = 2200 / 1238;                             /* suite screenshot ratio */
        /* never let the image cross the text column — no overlap at any width */
        var infosEl = suitesWrap.querySelector('.suite-infos');
        var rightOff = parseFloat(getComputedStyle(sFigs[i]).right) || 0;
        var maxW = vw - rightOff - (infosEl ? infosEl.getBoundingClientRect().right : 0) - 28;
        var w = Math.min((0.6 + 0.15 * ge) * vw, maxW);
        var h = w / AR;
        if (h > 0.70 * vh) {                              /* 15% air above + below */
          h = 0.70 * vh; w = h * AR;
          if (w > maxW) { w = maxW; h = w / AR; }
        }
        sFigs[i].style.width = w + 'px';
        sFigs[i].style.height = h + 'px';
        sFigs[i].style.top = ((vh - h) / 2) + 'px';
        sFigs[i].style.zIndex = 10 + i;
        /* 3) left info rises above the image, centered on the image's midline,
              and leaves BEFORE the next suite's image lands — text and
              screenshot always belong to the same suite */
        sInfos[i].style.marginTop = -(sInfos[i].offsetHeight / 2) + 'px';
        var it = Math.min(1, Math.max(0, (t - 0.45) / 0.35));
        var ie = 1 - Math.pow(1 - it, 3);
        var ot = Math.min(1, Math.max(0, (t - 0.97) / 0.18));
        sInfos[i].style.opacity = String(ie * (1 - ot));
        sInfos[i].style.transform = 'translateY(' + ((1 - ie) * 46 - ot * 30) + 'px)';
        sInfos[i].style.zIndex = 20 + i;
        sInfos[i].style.pointerEvents = (ie > 0.5 && ot < 0.5) ? 'auto' : 'none';
      }
    };
    window.addEventListener('scroll', suitesTick, { passive: true });
    suitesTick();
  }

  /* marquee: duplicate chips once so the -50% scroll loops seamlessly */
  document.querySelectorAll('[data-clone]').forEach(function (t) {
    t.innerHTML += t.innerHTML;
  });

  /* marquee: keeps scrolling on hover; a click stops it (click again to resume) */
  document.querySelectorAll('.mkt-marquee').forEach(function (marquee) {
    var track = marquee.querySelector('.mkt-track');
    if (!track) return;
    marquee.addEventListener('click', function (e) {
      e.preventDefault();            /* a click pauses/resumes rather than following the slide link */
      track.classList.toggle('mkt-paused');
    });
  });
})();
