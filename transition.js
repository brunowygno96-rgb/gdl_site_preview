(() => {
  'use strict';

  const overlay = document.getElementById('pageTransition');
  if (!overlay) return;

  const DURATION = 520;

  // Reveal the page shortly after load. The double rAF makes sure the
  // browser has painted the overlay at full opacity at least once before
  // the "hidden" class is added, so the fade-out actually animates instead
  // of the class landing before first paint and skipping the transition.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('is-hidden'));
  });

  document.querySelectorAll('a[href]').forEach((link) => {
    const url = link.getAttribute('href');
    const isInternalPage = url && !url.startsWith('#') && !url.startsWith('http') && link.target !== '_blank';
    if (!isInternalPage) return;

    link.addEventListener('click', (e) => {
      e.preventDefault();
      overlay.classList.remove('is-hidden');
      setTimeout(() => { window.location.href = url; }, DURATION);
    });
  });
})();
