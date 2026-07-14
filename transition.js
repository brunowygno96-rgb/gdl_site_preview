(() => {
  'use strict';

  const overlay = document.getElementById('pageTransition');
  if (!overlay) return;

  const DURATION = 550;

  // Reveal the page shortly after load: rise up and exit off the top.
  // The double rAF makes sure the browser has painted the overlay in its
  // covering state at least once before "is-above" is added, so this
  // actually animates instead of the class landing before first paint
  // and skipping the transition.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('is-above'));
  });

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
