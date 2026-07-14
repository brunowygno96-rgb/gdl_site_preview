(() => {
  'use strict';

  const overlay = document.getElementById('pageTransition');
  if (!overlay) return;

  const DURATION = 550;
  const LOGO_HOLD = 900;   // how long the loading screen holds with the logo showing
  const LOGO_FADE = 250;   // let the logo fade out before the bar itself starts rising

  // Initial load only: show the loading screen (logo on the white bar),
  // hold it for a beat, fade the logo out, then rise up and exit off the
  // top to reveal the page. Internal navigation (the click handler below)
  // skips the logo entirely — it's just the plain white bar covering and
  // uncovering.
  overlay.classList.add('is-loading');
  setTimeout(() => {
    overlay.classList.remove('is-loading');
    setTimeout(() => overlay.classList.add('is-above'), LOGO_FADE);
  }, LOGO_HOLD);

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
