'use strict';
const services = document.querySelector('#services');
if (services && 'IntersectionObserver' in window) {
  const colorObserver = new IntersectionObserver(([entry]) => {
    services.classList.toggle('services-in-view', entry.isIntersecting);
  }, { threshold: 0, rootMargin: '-18% 0px -18% 0px' });
  colorObserver.observe(services);
}

// Native buttons provide the same interaction for touch, mouse and keyboard.
const serviceRows = [...document.querySelectorAll('#services .svc')];
serviceRows.forEach(row => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'service-highlight';
  button.setAttribute('aria-label', 'Destacar serviço: ' + row.querySelector('h3').textContent);
  button.setAttribute('aria-pressed', 'false');
  row.append(button);
  button.addEventListener('click', () => {
    const activate = button.getAttribute('aria-pressed') !== 'true';
    serviceRows.forEach(other => {
      const selected = other === row && activate;
      other.classList.toggle('is-highlighted', selected);
      other.querySelector('.service-highlight').setAttribute('aria-pressed', String(selected));
    });
  });
  button.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      row.classList.remove('is-highlighted');
      button.setAttribute('aria-pressed', 'false');
    }
  });
});
