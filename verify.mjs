import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const events = {};
const menu = { value: 'false', getAttribute() { return this.value; }, setAttribute(_, value) { this.value = value; }, addEventListener(name, fn) { events[name] = fn; }, focus() { this.focused = true; } };
const navigation = { classList: { remove() { this.open = false; }, toggle(_, value) { this.open = value; } }, addEventListener(_, fn) { events.navigate = fn; } };
vm.runInNewContext(fs.readFileSync('navigation.js', 'utf8'), { document: { querySelector: s => s === '.menu-toggle' ? menu : navigation, addEventListener: (_, fn) => events.key = fn }, matchMedia: () => ({ addEventListener: (_, fn) => events.resize = fn }) });
events.click(); assert.equal(menu.value, 'true'); assert.equal(navigation.classList.open, true);
events.key({ key: 'Escape' }); assert.equal(menu.value, 'false'); assert.ok(menu.focused);
events.click(); events.navigate({ target: { closest: () => true } }); assert.equal(menu.value, 'false');
events.click(); events.resize(); assert.equal(menu.value, 'false');
console.log('Menu: open, Escape, link navigation and desktop reset passed.');
let onVisibility;
const services = { classList: { toggle(name, active) { assert.equal(name, 'services-in-view'); this.active = active; } } };
class Observer { constructor(callback) { onVisibility = callback; } observe(element) { assert.equal(element, services); } }
vm.runInNewContext(fs.readFileSync('section-motion.js', 'utf8'), { document: { querySelector: () => services }, window: { IntersectionObserver: Observer }, IntersectionObserver: Observer });
onVisibility([{ isIntersecting: true }]); assert.equal(services.classList.active, true);
onVisibility([{ isIntersecting: false }]); assert.equal(services.classList.active, false);
console.log('Services color transition: viewport entry and exit passed.');
