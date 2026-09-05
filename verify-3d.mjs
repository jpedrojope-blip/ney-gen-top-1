import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from './assets/vendor/three.module.js';
import { createLogo } from './hero3d.mjs';
const html = fs.readFileSync('index.html', 'utf8');
const logoMarkup = html.split('<div class="symbol">')[1].split('</svg>')[0];
const paths = [...logoMarkup.matchAll(/<path d="([^"]+)"/g)].map(match => match[1]);
assert.equal(paths.length, 2);
const material = new THREE.MeshBasicMaterial();
const logo = createLogo(THREE, paths, material, material);
assert.equal(logo.children.length, 2);
for (const mesh of logo.children) {
  assert.ok(mesh.geometry.attributes.position.count > 100);
  assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
  mesh.geometry.computeBoundingBox();
  assert.ok(mesh.geometry.boundingBox.max.z - mesh.geometry.boundingBox.min.z > .38);
  assert.equal(mesh.geometry.groups.length, 2);
  mesh.geometry.dispose();
}
material.dispose();
console.log('3D: both brand polygons extruded, finite vertices, depth and material groups passed.');
