(() => {
  'use strict';

  // ---------- Project data ----------
  const CARDS = 'assets/cards/';
  const projects = [
    { client: 'Kim Minjae',                  title: 'Digital Content',       image: CARDS + '0001 - Kim Minjae.webp' },
    { client: 'Resulta Digital',              title: 'Ventures',              image: CARDS + '0002 - Resulta Digital.webp' },
    { client: 'Nicolas Jackson x Spyders',    title: 'Digital Content',       image: CARDS + '0003 - Nicolas Jackson.webp' },
    { client: 'Bwing',                        title: 'Ventures',              image: CARDS + '0004 - Bwing.webp' },
    { client: 'Tamires Dias',                 title: 'Social Media',          image: CARDS + '0005 - Tamires Dias.webp' },
    { client: 'Ruben Vargas',                 title: 'Social Media',          image: CARDS + '0006 - Ruben Vargas.webp' },
    { client: 'Corinthians',                  title: 'Brand Partnerships',    image: CARDS + '0007 - Corinthians.webp' },
    { client: 'Séan Garnier',                 title: 'Growth Projects',       image: CARDS + '0008 - Séan Garnier.webp' },
    { client: 'Joe Hart',                     title: 'Social Media',          image: CARDS + '0009 - Joe Hart.webp' },
    { client: 'CBF',                          title: 'Digital Content',       image: CARDS + '0010 - CBF.webp' },
    { client: 'Ronaldo x Octagon',            title: 'Growth Projects',       image: CARDS + '0011 - Ronaldo.webp' },
    { client: 'Ricardo Quaresma',             title: 'Digital Content',       image: CARDS + '0012 - Ricardo Quaresma.webp' },
    { client: 'Stephan Lichtsteiner',         title: 'Digital Content',       image: CARDS + '0013 - Stephan Lichtsteiner.webp' },
    { client: 'Umbro',                        title: 'Brand Partnerships',    image: CARDS + '0014 - Umbro.webp' },
    { client: 'Falcão',                       title: 'Digital Content',       image: CARDS + '0015 - Falcão.webp' },
    { client: 'Adidas',                       title: 'Brand Partnerships',    image: CARDS + '0016 - Adidas.webp' },
  ];

  const track = document.getElementById('galleryTrack');
  const viewport = document.getElementById('galleryViewport');
  const scrollHint = document.getElementById('scrollHint');
  const cursorFollower = document.getElementById('cursorFollower');

  // Build DOM — duplicate the set 3x for a seamless infinite loop.
  // The photo lives in an inner .project-thumb-img element so it can be
  // counter-scaled against the card's own non-uniform scale — the outer
  // card shrinks (cropping the visible window tighter), while the photo
  // itself always renders at its true, undistorted proportions.
  const buildCard = (p) => {
    const card = document.createElement('div');
    card.className = 'project-card' + (p.soon ? ' soon' : '');
    const thumbStyle = p.image
      ? `background-image:url('${p.image}');background-size:cover;background-position:center;`
      : `background:#141414;`;
    card.innerHTML = `
      <div class="project-thumb"><div class="project-thumb-img" style="${thumbStyle}"></div></div>
      <div class="project-info">
        <span class="project-client">${p.client}</span>
      </div>
      <div class="project-title">${p.title}</div>
    `;
    return card;
  };

  const SETS = 3;
  for (let s = 0; s < SETS; s++) {
    projects.forEach((p) => track.appendChild(buildCard(p)));
  }

  const cardEls = Array.from(track.children);
  const thumbImgEls = cardEls.map((card) => card.querySelector('.project-thumb-img'));
  // Tracks which cards had any focus last frame, so fully-receded cards
  // that aren't changing can skip their (fairly expensive: grayscale
  // filter + box-shadow + transform) style writes entirely instead of
  // reapplying the same values 60 times a second.
  const wasActive = new Array(cardEls.length).fill(true);

  // ---------- Intro animation ----------
  // Cards fall from above and land into their real filmstrip position like
  // a cascade — staggered left to right (by position within one set, so
  // all 3 repeated sets fall in the same wave), each with a slight
  // overshoot bounce on landing. Input is ignored until every card has
  // landed so a wheel flick or drag can't collide with the settle.
  const CASCADE_STEP = 40;   // ms of extra delay per card, left to right
  const FALL_DURATION = 850; // ms each individual card takes to fall
  const FALL_HEIGHT = window.innerHeight * 0.9 + 300; // start well above the viewport
  const introDelays = cardEls.map((_, i) => (i % projects.length) * CASCADE_STEP);
  const introRotations = cardEls.map(() => (Math.random() * 2 - 1) * 6);
  const INTRO_TOTAL = Math.max(...introDelays) + FALL_DURATION;
  let introStart = null;
  let introDone = false;

  // Cards stay parked off-screen (frozen, not falling) until the page
  // transition overlay (transition.js) actually starts rising to reveal
  // the page — otherwise the cascade played out while still hidden behind
  // the white loading bar, so by the time it lifted the cards had already
  // finished falling. The timeout is just a safety net in case that event
  // never arrives for some reason (e.g. transition.js failed to load).
  let introTriggered = false;
  window.addEventListener('gdl:reveal', () => { introTriggered = true; }, { once: true });
  setTimeout(() => { introTriggered = true; }, 3000);

  const easeOutBack = (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  // ---------- Infinite bidirectional smooth scroll ----------
  let current = 0;
  let target = 0;
  let velocity = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartTarget = 0;
  let lastDragX = 0;
  let setWidth = 0;
  let hintHidden = false;

  // PITCH/PHASE describe the card layout in track-local coordinates (via
  // offsetLeft, unaffected by the live scroll transform) so the center-snap
  // math stays correct no matter where the deck currently sits.
  let PITCH = 150;
  let PHASE = 0;
  let baseWidth = 0;
  let baseCenter = [];

  // Filmstrip focus effect: off-center cards collapse into thin,
  // near-full-height slivers; the centered card expands to its full size.
  const MIN_SCALE_X = 0.3;
  const MAX_SCALE_X = 1.0;
  const MIN_SCALE_Y = 0.92;
  const MAX_SCALE_Y = 1.0;
  let FOCUS_RADIUS = 598;
  let PUSH_AMOUNT = 299;

  // The caption (number/client/year/title) only fades in during the very
  // last stretch of a card's approach to center — everywhere else it's
  // fully hidden, so exactly one caption is ever visible at a time.
  const TEXT_REVEAL_START = 0.82;

  // Debounced "settle" snap: after the wheel/drag input goes idle, the
  // nearest card glides into the exact center. 150ms was shorter than the
  // gap between individual notches on a standard (non-trackpad) mouse
  // wheel, so mid-scroll the snap kept firing between ticks and then
  // getting overridden by the next tick — read as a slight hitch while
  // still actively scrolling. Comfortably longer than that gap here.
  let usingWheel = false;
  let wheelIdleTimer = null;
  const WHEEL_SETTLE_DELAY = 260;

  // measure() re-runs on every window `resize` event — and browsers/OSes
  // do fire that spuriously (a maximized window is especially prone to
  // this, e.g. from Windows DPI/scaling rounding the client area by a
  // pixel). It used to unconditionally reset current/target back to the
  // start, so a spurious resize looked exactly like a jolt back to the
  // middle of the deck. Only the very first call (initial page load)
  // should do that; every later call just needs to refresh the geometry
  // without moving the scroll position out from under the user.
  let measured = false;

  const measure = () => {
    const isMobile = window.innerWidth <= 720;
    FOCUS_RADIUS = isMobile ? 390 : 598;
    PUSH_AMOUNT = isMobile ? 195 : 299;

    if (cardEls.length > 1) {
      const c0 = cardEls[0].offsetLeft + cardEls[0].offsetWidth / 2;
      const c1 = cardEls[1].offsetLeft + cardEls[1].offsetWidth / 2;
      const pitch = Math.abs(c1 - c0);
      if (pitch > 0) PITCH = pitch;
    }

    // The true width of one repeating set is PITCH * card count — deriving
    // it from track.scrollWidth instead would fold in the track's own
    // padding, which doesn't repeat per set and breaks the loop seam.
    setWidth = PITCH * projects.length;
    const centerX = window.innerWidth / 2;
    PHASE = (cardEls[0].offsetLeft + cardEls[0].offsetWidth / 2) - centerX;

    baseWidth = cardEls[0].offsetWidth;
    baseCenter = cardEls.map((card) => card.offsetLeft + card.offsetWidth / 2);

    if (!measured) {
      // Open centered on Joe Hart, using his copy in the middle set so
      // there's a full set of scroll buffer on both sides.
      const startIndex = projects.length + projects.findIndex((p) => p.client === 'Joe Hart');
      current = PHASE + startIndex * PITCH;
      target = current;
      measured = true;
    }
  };

  const hideHint = () => {
    if (hintHidden) return;
    hintHidden = true;
    scrollHint.classList.add('hidden');
  };

  const wrap = (v) => {
    let w = v % setWidth;
    if (w < 0) w += setWidth;
    return w;
  };

  const snapToNearest = () => {
    target = Math.round((target - PHASE) / PITCH) * PITCH + PHASE;
  };

  // Frame-rate-independent easing: the factors below (0.085 lerp, 0.92
  // friction) are tuned for a steady 60fps, i.e. one call every ~16.7ms.
  // Heavier paint/composite work (a maximized window has far more pixels
  // to render than a smaller one) can make individual frames arrive late
  // or get dropped; without accounting for that, this loop would keep
  // applying a fixed per-call step regardless of how much real time had
  // actually passed, which reads as stutter under load. `dt` normalizes
  // every step to the real elapsed time instead, so the motion stays
  // smooth even when the frame rate itself isn't steady.
  let lastFrameTime = null;

  const render = (timestamp) => {
    let dt = 1;
    if (lastFrameTime !== null) {
      dt = (timestamp - lastFrameTime) / (1000 / 60);
      dt = Math.min(dt, 4); // cap the catch-up after a long stall (e.g. a backgrounded tab)
    }
    lastFrameTime = timestamp;

    if (introTriggered && introStart === null) introStart = timestamp;
    const introElapsed = introStart === null ? 0 : timestamp - introStart;
    if (introElapsed >= INTRO_TOTAL && !introDone) {
      introDone = true;
      for (const card of cardEls) card.style.opacity = '';
    }

    current += (target - current) * (1 - Math.pow(1 - 0.085, dt));
    if (!isDragging) {
      current += velocity * dt;
      target += velocity * dt;
      velocity *= Math.pow(0.92, dt);
      if (Math.abs(velocity) < 0.02) velocity = 0;
    }
    // Once every input has settled (no active drag, no coasting momentum,
    // no pending wheel debounce), lock the nearest card to center.
    if (!isDragging && !usingWheel && velocity === 0) {
      snapToNearest();
    }

    // The deck only has 3 duplicated sets of cards as a scroll buffer.
    // Scrolling far enough in one direction for long enough eventually
    // exhausts that buffer (runs past the last real card), which showed up
    // as a jolt right as the deck needed to reset. Shifting current/target
    // by a whole multiple of setWidth doesn't change the rendered position
    // at all (pos is already current % setWidth), so recentering here is
    // completely invisible — it just happens before the buffer runs out
    // instead of after.
    //
    // Two refinements over the first version of this fix: (1) it only
    // fires while nothing is actively being dragged — dragMove() rebuilds
    // `target` from `dragStartTarget` every move, and that reference
    // wasn't shifted, so a recenter mid-drag re-introduced the exact jolt
    // it was meant to prevent; (2) the trigger window is much wider now
    // (using most of the 3-set buffer instead of just half of it), so it
    // fires far less often — which was the "trava ao passar do último
    // para o primeiro" feeling, since with the old tight window it could
    // trigger roughly twice per full pass through the project list.
    if (!isDragging && (current < setWidth * 0.4 || current > setWidth * 2.6)) {
      const shift = Math.round((current - setWidth) / setWidth) * setWidth;
      current -= shift;
      target -= shift;
    }

    const pos = wrap(current);
    track.style.transform = `translate3d(${-pos}px, 0, 0)`;

    // Filmstrip effect: cards part ways and expand as they near the
    // viewport center, revealing the full photo; off-center cards
    // collapse back into thin slivers. Same per-card curve as before,
    // unchanged — computed into arrays first so a corrective pass can run
    // afterward (see below) without touching this formula at all.
    //
    // Distance is computed analytically from each card's static layout
    // position (baseCenter, cached once) plus the current scroll offset —
    // never from the card's own last-rendered transform via
    // getBoundingClientRect(). Reading the rendered position would feed
    // last frame's push/scale back into this frame's distance calculation,
    // creating a feedback loop between "how pushed a card is" and "how far
    // it measures from center" that could destabilize right around
    // whichever transition happened to be least forgiving numerically —
    // which is what was showing up as a localized stutter at one specific
    // pair of cards.
    const centerX = window.innerWidth / 2;
    const n = cardEls.length;
    const t = new Array(n);
    const scaleX = new Array(n);
    const scaleY = new Array(n);
    const push = new Array(n);

    for (let i = 0; i < n; i++) {
      const dist = (baseCenter[i] - pos) - centerX;
      t[i] = Math.max(0, 1 - Math.abs(dist) / FOCUS_RADIUS);
      const dir = dist >= 0 ? 1 : -1;
      push[i] = dir * (1 - t[i]) * PUSH_AMOUNT;
      scaleX[i] = MIN_SCALE_X + (MAX_SCALE_X - MIN_SCALE_X) * t[i];
      scaleY[i] = MIN_SCALE_Y + (MAX_SCALE_Y - MIN_SCALE_Y) * t[i];
    }

    // Safety pass, left to right: the curve above can very occasionally
    // leave a sliver of daylight between two neighbors when their scale
    // changes at different rates. Only when that happens, nudge the card
    // left just enough to touch its neighbor — everywhere else (the vast
    // majority of the curve) is left completely untouched, so the
    // animation itself is unaffected.
    let prevRightEdge = null; // no real neighbor to compare the first card against
    for (let i = 0; i < n; i++) {
      const screenPos = (baseCenter[i] - pos) + push[i];
      const halfWidth = (baseWidth * scaleX[i]) / 2;
      const leftEdge = screenPos - halfWidth;
      const correctedPos = (prevRightEdge !== null && leftEdge > prevRightEdge)
        ? screenPos - (leftEdge - prevRightEdge)
        : screenPos;
      push[i] = correctedPos - (baseCenter[i] - pos);
      prevRightEdge = correctedPos + halfWidth;
    }

    for (let i = 0; i < n; i++) {
      const card = cardEls[i];
      // Position must update every frame for every card, even fully-receded
      // ones — they're still sliding past on-screen with the rest of the
      // deck, just not in focus. This part is cheap (compositor-only).
      // introMix folds in the falling-cascade offset — it's 0 once a card
      // has landed, so this collapses back to the plain resting transform
      // with no extra cost or branching.
      let introMix = 0;
      if (!introDone) {
        const localT = Math.max(0, Math.min(1, (introElapsed - introDelays[i]) / FALL_DURATION));
        introMix = 1 - easeOutBack(localT);
      }
      const iy = -FALL_HEIGHT * introMix;
      const irot = introRotations[i] * introMix;
      card.style.transform = `translate3d(${push[i]}px, ${iy}px, 0) rotate(${irot}deg) scale(${scaleX[i]}, ${scaleY[i]})`;
      if (!introDone) card.style.opacity = String(1 - introMix * 0.85);

      // Everything below (grayscale filter, z-index, the photo's own
      // counter-scale) is constant once a card is fully receded — only the
      // ~10 cards inside the focus radius actually need it recomputed each
      // frame. Skipping it for settled cards avoids reapplying the same
      // (fairly expensive: filter forces a real repaint, not just
      // compositing) values 60 times a second, which is what was making
      // the animation stutter at full window size, where every element
      // renders at its largest pixel area.
      const isActive = t[i] > 0;
      if (!isActive && !wasActive[i]) continue;
      wasActive[i] = isActive;

      const textT = Math.max(0, Math.min(1, (t[i] - TEXT_REVEAL_START) / (1 - TEXT_REVEAL_START)));
      card.style.zIndex = Math.round(t[i] * 1000);
      card.style.setProperty('--t', t[i].toFixed(3));
      card.style.setProperty('--text-t', textT.toFixed(3));
      // Counter-scale the photo so the card's own non-uniform scale never
      // stretches it — the crop window just gets tighter or wider. netScale
      // is the smallest uniform scale that still covers the card's window
      // in both dimensions (like background-size:cover would).
      const netScale = Math.max(scaleX[i], scaleY[i]);
      thumbImgEls[i].style.transform = `scale(${netScale / scaleX[i]}, ${netScale / scaleY[i]})`;
    }

    requestAnimationFrame(render);
  };

  // ---------- Wheel ----------
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!introDone) return; // don't let a scroll collide with the settle animation
    hideHint();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    target += delta * 1.15;
    velocity = 0;
    usingWheel = true;
    clearTimeout(wheelIdleTimer);
    wheelIdleTimer = setTimeout(() => { usingWheel = false; }, WHEEL_SETTLE_DELAY);
  }, { passive: false });

  // ---------- Drag (mouse) ----------
  const dragStart = (clientX) => {
    if (!introDone) return; // don't let a drag collide with the settle animation
    isDragging = true;
    velocity = 0;
    usingWheel = false;
    clearTimeout(wheelIdleTimer);
    dragStartX = clientX;
    lastDragX = clientX;
    dragStartTarget = target;
    viewport.classList.add('dragging');
    hideHint();
  };

  const dragMove = (clientX) => {
    if (!isDragging) return;
    const delta = clientX - dragStartX;
    target = dragStartTarget - delta;
    velocity = (lastDragX - clientX) * 0.5;
    lastDragX = clientX;
  };

  const dragEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    viewport.classList.remove('dragging');
  };

  viewport.addEventListener('mousedown', (e) => dragStart(e.clientX));
  window.addEventListener('mousemove', (e) => dragMove(e.clientX));
  window.addEventListener('mouseup', dragEnd);
  viewport.addEventListener('mouseleave', () => { if (isDragging) dragEnd(); });

  // ---------- Drag (touch) ----------
  viewport.addEventListener('touchstart', (e) => dragStart(e.touches[0].clientX), { passive: true });
  viewport.addEventListener('touchmove', (e) => dragMove(e.touches[0].clientX), { passive: true });
  viewport.addEventListener('touchend', dragEnd);

  // ---------- Keyboard ----------
  window.addEventListener('keydown', (e) => {
    if (!introDone) return; // don't let a nudge collide with the settle animation
    if (e.key === 'ArrowRight') { target += PITCH; hideHint(); }
    if (e.key === 'ArrowLeft') { target -= PITCH; hideHint(); }
  });

  // ---------- Custom cursor ----------
  // Replaces the native cursor everywhere on the site (no arrow, no hand) —
  // revealed on the first mousemove so it doesn't flash at (0,0) on load.
  if (window.matchMedia('(pointer: fine)').matches) {
    let cx = window.innerWidth / 2, cy = window.innerHeight / 2, fx = cx, fy = cy;
    let revealed = false;
    window.addEventListener('mousemove', (e) => {
      cx = e.clientX;
      cy = e.clientY;
      if (!revealed) {
        revealed = true;
        cursorFollower.style.opacity = '1';
      }
    });
    cardEls.forEach((card) => {
      card.addEventListener('mouseenter', () => cursorFollower.classList.add('active'));
      card.addEventListener('mouseleave', () => cursorFollower.classList.remove('active'));
    });
    const followCursor = () => {
      fx += (cx - fx) * 0.18;
      fy += (cy - fy) * 0.18;
      cursorFollower.style.transform = `translate(${fx}px, ${fy}px) scale(${cursorFollower.classList.contains('active') ? 1 : 0.4})`;
      requestAnimationFrame(followCursor);
    };
    followCursor();
  }

  // ---------- Init ----------
  window.addEventListener('resize', measure);
  measure();
  requestAnimationFrame(render);
})();
