'use strict';
const services = document.querySelector('#services');
if (services && 'IntersectionObserver' in window) {
  const colorObserver = new IntersectionObserver(([entry]) => {
    services.classList.toggle('services-in-view', entry.isIntersecting);
  }, { threshold: 0, rootMargin: '-18% 0px -18% 0px' });
  colorObserver.observe(services);
}
