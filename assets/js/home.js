/* NEMI home — chrome + interactions (adapted from the reference build) */

(function () {
  var nav =
    '<header class="nav"><div class="wrap">' +
    '<a class="nav__logo" href="home.html"><img src="assets/img/logo-dark.png?v=2" alt="NEMI"></a>' +
    '<nav class="nav__links" id="menu">' +
    '<a href="home.html" class="active">Home</a>' +
    '<a href="about.html">About Us</a>' +
    '<a href="offerings.html">Offerings</a>' +
    '<a href="blog.html">Blog</a>' +
    '<a href="careers.html">Careers</a>' +
    '<a href="contact.html" class="nav__cta">Contact</a>' +
    '</nav>' +
    '<button class="nav__burger" aria-label="Menu"><span></span><span></span><span></span></button>' +
    '</div></header>';


  document.body.insertAdjacentHTML('afterbegin', nav);

  /* (hero typewriter lives further down: types into .hero-type inside the
     ghost-reserved headline, holds the lede until done, caret never stops) */

  /* mobile menu */
  var burger = document.querySelector('.nav__burger');
  var menu = document.getElementById('menu');
  if (burger && menu) {
    burger.addEventListener('click', function () { menu.classList.toggle('open'); });
  }

  /* Logo (header + footer) returns you to the top of the page. We're already on
     home, so glide up instead of reloading the whole page. */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var logo = t.closest('.nav__logo, .foot-logo');
    if (!logo) return;
    e.preventDefault();
    if (menu) menu.classList.remove('open');          /* close the mobile drawer */
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });

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

  /* hero: the whole sentence types itself in plain white, then the description
     fades up. The caret is left blinking (the .typing class is never removed). */
  var heroTitle = document.getElementById('heroTitle');
  var heroLede = document.getElementById('heroLede');
  var heroParts = heroTitle ? Array.prototype.slice.call(heroTitle.querySelectorAll('.ht')) : [];
  if (heroParts.length) {
    var heroDone = function () {
      if (heroLede) heroLede.classList.add('is-in');
    };
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      heroParts.forEach(function (p) { p.textContent = p.getAttribute('data-text'); });
      heroDone();
    } else {
      heroTitle.classList.add('typing');
      var pi = 0, ci = 0;
      (function typeStep() {
        if (pi >= heroParts.length) { setTimeout(heroDone, 200); return; }
        var full = heroParts[pi].getAttribute('data-text');
        ci++;
        heroParts[pi].textContent = full.slice(0, ci);
        if (ci >= full.length) { pi++; ci = 0; }
        setTimeout(typeStep, 64);
      })();
    }
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
  /* The deck stacks on every width now, not just desktop — the CSS keeps the
     sticky pane on mobile too. Skipped only for reduced-motion, where the CSS
     falls back to a plain vertical list. */
  var deckOn = deckCards.length &&
    !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (deckOn) {
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
          /* dim via an overlay's opacity, not a CSS filter: a filter over a playing
             video forces a full recomposite of every decoded frame and stutters */
          c.style.setProperty('--dim', (0.16 * Math.min(d, 1)).toFixed(3));
        } else {
          c.style.transform = 'translateY(' + (Math.min(-d, 1) * 112) + '%)';
          c.style.setProperty('--dim', '0');
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
  /* The deck ticker starts the typewriter when card 03 slides in. Only fall
     back to an in-view trigger when the deck is not running at all. */
  if (typeEm && !deckOn) {
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

  /* Narrow screens: the desktop pairing animation is off and everything is
     static, so the markup's natural order renders all three screenshots first
     and all three descriptions after. Move each screenshot in under its own
     description, so it reads Anvil > shot > Orion > shot > Atlas > shot. */
  if (suitesWrap && window.innerWidth <= 860) {
    var mFigs = Array.prototype.slice.call(suitesWrap.querySelectorAll('.suite-media figure'));
    var mInfos = Array.prototype.slice.call(suitesWrap.querySelectorAll('.suite-info'));
    mInfos.forEach(function (info, i) {
      if (mFigs[i]) info.appendChild(mFigs[i]);
    });
    suitesWrap.classList.add('suites-paired');
  }

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

  /* fortress tiles: each photo drifts inside its own frame as the section
     crosses the viewport. The motion is on the image layer, never on the grid,
     so the tiles stay locked to their cells. Alternating direction by column
     keeps neighbouring frames from moving in lockstep. */
  var fort = document.getElementById('fortPhotos');
  if (fort && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    var fTiles = fort.querySelectorAll('.img-block');
    var fRaf = 0;
    var fortDraw = function () {
      fRaf = 0;
      var narrow = window.innerWidth <= 700;
      var vh = window.innerHeight;
      for (var i = 0; i < fTiles.length; i++) {
        var layer = fTiles[i].querySelector('.ib-par');
        if (!layer) continue;
        if (narrow) { layer.style.transform = ''; continue; }
        var r = fTiles[i].getBoundingClientRect();
        /* 0 as this tile enters from below, 1 once it has passed the top */
        var p = (vh - r.top) / (vh + r.height);
        p = Math.min(1, Math.max(0, p));
        var dir = (i % 2 === 0) ? 1 : -1;
        var y = (p - 0.5) * 2 * 18 * dir; /* -18px .. +18px inside the frame */
        layer.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0)';
      }
    };
    var fortTick = function () { if (!fRaf) fRaf = requestAnimationFrame(fortDraw); };
    window.addEventListener('scroll', fortTick, { passive: true });
    window.addEventListener('resize', fortTick);
    fortTick();
  }

  /* marquee: duplicate chips once so the -50% scroll loops seamlessly */
  document.querySelectorAll('[data-clone]').forEach(function (t) {
    t.innerHTML += t.innerHTML;
  });

  /* marquee: drifts on its own, and can also be scrolled by hand (drag, swipe, wheel).
     The track is duplicated above, so wrapping at the halfway point loops seamlessly. */
  document.querySelectorAll('.mkt-marquee').forEach(function (marquee) {
    var track = marquee.querySelector('.mkt-track');
    if (!track) return;

    var LOOP_MS = 150000;            /* one full pass of the list, as before */
    var IDLE = 2000;                 /* resume drifting this long after you let go */
    var slow = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var paused = false;              /* toggled by a plain click */
    var resumeAt = 0;                /* set after any manual interaction */
    var dragging = false, startX = 0, startScroll = 0, moved = false;

    /* Keep our own float position: reading back element.scrollLeft rounds to whole
       pixels, so accumulating a sub-pixel step directly on it never moves at all. */
    var pos = marquee.scrollLeft;
    var last = 0;

    function hold() { resumeAt = Date.now() + IDLE; }

    function step(now) {
      var half = track.scrollWidth / 2;
      var dt = last ? Math.min(now - last, 64) : 0;   /* clamp after a tab switch */
      last = now;

      if (half > 0) {
        var manual = dragging || paused || slow || Date.now() < resumeAt;
        if (manual) {
          pos = marquee.scrollLeft;                   /* user is driving; follow them */
        } else {
          pos += (half / LOOP_MS) * dt;               /* time-based, so 60Hz and 120Hz match */
        }
        /* wrap both ways, so dragging backwards is endless too */
        if (pos >= half) pos -= half;
        else if (pos < 0) pos += half;
        if (!manual) marquee.scrollLeft = pos;
        else if (marquee.scrollLeft >= half || marquee.scrollLeft < 0) marquee.scrollLeft = pos;
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);

    /* wheel / trackpad / touch use native scrolling; just pause the drift briefly */
    marquee.addEventListener('wheel', hold, { passive: true });
    marquee.addEventListener('touchstart', hold, { passive: true });
    marquee.addEventListener('touchmove', hold, { passive: true });

    /* click-drag to scroll (mouse only; touch already scrolls natively) */
    marquee.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      dragging = true; moved = false;
      startX = e.clientX; startScroll = marquee.scrollLeft;
      marquee.classList.add('is-grabbing');
    });
    marquee.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      marquee.scrollLeft = startScroll - dx;
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false; hold();
      marquee.classList.remove('is-grabbing');
    }
    marquee.addEventListener('pointerup', endDrag);
    marquee.addEventListener('pointercancel', endDrag);
    marquee.addEventListener('pointerleave', endDrag);

    /* a drag must not follow the slide's link; a plain click still pauses/resumes */
    marquee.addEventListener('click', function (e) {
      e.preventDefault();
      if (!moved) paused = !paused;
      moved = false;
    });
  });
})();

/* thesis deck videos play at 0.75x */
(function () {
  var rate = 0.75;
  var vids = document.querySelectorAll('.thesis-vid video');
  Array.prototype.forEach.call(vids, function (v) {
    var set = function () { v.playbackRate = rate; };
    set();
    v.addEventListener('loadedmetadata', set);
    v.addEventListener('play', set);
    v.addEventListener('ratechange', function () { if (v.playbackRate !== rate) set(); });
  });
})();
