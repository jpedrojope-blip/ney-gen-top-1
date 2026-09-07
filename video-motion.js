'use strict';
const brandFilm = document.querySelector('#brandvid');
if (brandFilm) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let inView = false;

  function syncFilm() {
    if (reducedMotion.matches || document.hidden || !inView || brandFilm.paused && brandFilm.dataset.userPaused === 'true') {
      brandFilm.pause();
      return;
    }
    brandFilm.play().catch(() => {});
  }

  brandFilm.addEventListener('pause', () => {
    if (!brandFilm.ended) brandFilm.dataset.userPaused = 'true';
  });
  brandFilm.addEventListener('play', () => { delete brandFilm.dataset.userPaused; });
  brandFilm.addEventListener('ended', () => { delete brandFilm.dataset.userPaused; });
  brandFilm.addEventListener('focusin', () => brandFilm.pause());
  brandFilm.addEventListener('focusout', syncFilm);
  document.addEventListener('visibilitychange', syncFilm);
  reducedMotion.addEventListener('change', syncFilm);

  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    syncFilm();
  }, { threshold: .35 });
  observer.observe(brandFilm);
}
