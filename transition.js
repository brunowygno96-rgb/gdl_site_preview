(() => {
  'use strict';

  const overlay = document.getElementById('pageTransition');
  if (!overlay) return;

  const DURATION = 550;
  const LOGO_HOLD = 900;   // how long the loading screen holds with the logo showing
  const LOGO_FADE = 250;   // let the logo fade out before the bar itself starts rising

  // Fires the moment the bar actually starts rising to reveal the page —
  // script.js listens for this so the gallery's own cascade intro doesn't
  // start (and finish) while it's still hidden behind the bar.
  const reveal = () => {
    overlay.classList.add('is-above');
    window.dispatchEvent(new Event('gdl:reveal'));
  };

  // The logo loading screen is a first-impression thing — show it once
  // per browser session (sessionStorage), not on every internal page
  // load. Without this, clicking About after already seeing the intro on
  // the home page would show the whole loading screen again.
  const introAlreadyShown = sessionStorage.getItem('gdl-intro-shown');
  if (!introAlreadyShown) {
    sessionStorage.setItem('gdl-intro-shown', '1');
    overlay.classList.add('is-loading');
    setTimeout(() => {
      overlay.classList.remove('is-loading');
      setTimeout(reveal, LOGO_FADE);
    }, LOGO_HOLD);
  } else {
    requestAnimationFrame(() => requestAnimationFrame(reveal));
  }

  document.querySelectorAll('a[href]').forEach((link) => {
    const url = link.getAttribute('href');
    const isInternalPage = url && !url.startsWith('#') && !url.startsWith('http') && link.target !== '_blank';
    if (!isInternalPage) return;

    link.addEventListener('click', (e) => {
      e.preventDefault();

      // Jump below the viewport instantly (no transition — it's out of
      // sight either way), then let it rise back up to cover the screen.
      // Same upward motion as the reveal, just starting from the other
      // hidden edge, so the two animations read as one continuous sweep.
      overlay.classList.add('no-transition');
      overlay.classList.remove('is-above');
      overlay.classList.add('is-below');
      overlay.offsetHeight; // force reflow so the jump above applies before re-enabling the transition
      overlay.classList.remove('no-transition');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => overlay.classList.remove('is-below'));
      });

      setTimeout(() => { window.location.href = url; }, DURATION);
    });
  });
})();
