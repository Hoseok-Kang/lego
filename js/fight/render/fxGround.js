// 바닥 효과 (퍼지는 고리, 빨간 경고 원)
// '펑' 할 때 바닥에 퍼지는 고리와, 망치 토끼가 내려치기 전에 바닥에 차오르는 빨간 원을 그립니다.
// 모양은 미리 몇 개 만들어 두고 돌려 씁니다.
//
//   const ground = createGroundFx(scene)
//   ground.ring(x, z, 시작반지름, 끝반지름, 초, 색(Color), 굵게 = true, 투명도 = 0.9)   퍼지며 사라지는 고리
//   ground.telegraph(x, z, 반지름, 초) → { cancel() }   빨간 원이 가운데부터 차오름 → 다 차면 번쩍하고 사라짐
//   ground.update(dt) ; ground.clear()
//
// 색·높이는 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';

const FLOOR_Y = 0.24; // 바닥 돌기(0.16)보다 살짝 위
const TELEGRAPH_HEX = '#C91A09'; // 경고 원 테두리 색 (빨강)
const TELEGRAPH_FILL_HEX = '#FF698F'; // 차오르는 안쪽 색 (코랄)
const TELEGRAPH_EDGE_HEX = '#F4F4F4'; // 차오르는 가장자리 색 (흰색)
const TELEGRAPH_FADE = 0.16; // 다 찬 뒤 사라지는 시간
const STRIPE_SCALE = 0.32; // 경고 원 안 빗금 촘촘함 (클수록 촘촘)
const RING_COUNT = 10;
const TELEGRAPH_COUNT = 5;

export function createGroundFx(scene) {
  const thick = new THREE.RingGeometry(0.72, 1, 56).rotateX(-Math.PI / 2);
  const thin = new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2);
  const disc = new THREE.CircleGeometry(1, 56).rotateX(-Math.PI / 2);

  const makeMesh = (geometry, hex, order) => {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(hex),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    scene.add(mesh);
    return mesh;
  };

  // 빗금 무늬 원 (빨강·코랄 빗금이 천천히 흘러감) — 반투명 빨강을 잔디 위에 깔면 흙색처럼 탁해져서 빗금으로 그림
  const stripeColorA = new THREE.Color(TELEGRAPH_HEX);
  const stripeColorB = new THREE.Color(TELEGRAPH_FILL_HEX);
  const makeStriped = (geometry) => {
    const material = new THREE.ShaderMaterial({
      uniforms: { uA: { value: stripeColorA }, uB: { value: stripeColorB }, uOpacity: { value: 0 }, uTime: { value: 0 }, uScale: { value: STRIPE_SCALE } },
      vertexShader: /* glsl */ `
        varying vec2 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uA;
        uniform vec3 uB;
        uniform float uOpacity;
        uniform float uTime;
        uniform float uScale;
        varying vec2 vWorld;
        void main() {
          float band = fract((vWorld.x + vWorld.y) * uScale - uTime * 1.6);
          float stripe = step(0.5, band);
          gl_FragColor = vec4(mix(uA, uB, stripe), uOpacity * mix(1.0, 0.8, stripe));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
    return mesh;
  };

  // ── 퍼지는 고리 ──
  const rings = [];
  for (let i = 0; i < RING_COUNT; i++) {
    rings.push({ thick: makeMesh(thick, '#F4F4F4', 2), thin: makeMesh(thin, '#F4F4F4', 2), mesh: null, active: false, age: 0, life: 1, r0: 1, r1: 2, alpha: 1 });
  }
  let nextRing = 0;

  function ring(x, z, r0, r1, seconds, color, bold = true, alpha = 0.9, y = FLOOR_Y) {
    const item = rings[nextRing];
    nextRing = (nextRing + 1) % rings.length;
    if (item.mesh) item.mesh.visible = false;
    item.mesh = bold ? item.thick : item.thin;
    item.mesh.material.color.copy(color);
    item.mesh.position.set(x, y, z);
    item.mesh.visible = true;
    item.active = true;
    item.age = 0;
    item.life = Math.max(0.05, seconds);
    item.r0 = r0;
    item.r1 = r1;
    item.alpha = alpha;
    updateRing(item, 0);
  }

  function updateRing(item, dt) {
    item.age += dt;
    const p = item.age / item.life;
    if (p >= 1) {
      item.active = false;
      item.mesh.visible = false;
      return;
    }
    const grow = 1 - (1 - p) * (1 - p) * (1 - p);
    const r = item.r0 + (item.r1 - item.r0) * grow;
    item.mesh.scale.set(r, 1, r);
    item.mesh.material.opacity = item.alpha * (1 - p * p);
  }

  // ── 빨간 경고 원 ──
  const telegraphs = [];
  for (let i = 0; i < TELEGRAPH_COUNT; i++) {
    telegraphs.push({
      outline: makeMesh(thin, TELEGRAPH_HEX, 1),
      fill: makeStriped(disc),
      front: makeMesh(thin, TELEGRAPH_EDGE_HEX, 2),
      active: false,
      age: 0,
      seconds: 1,
      radius: 1,
      token: 0,
    });
  }

  function telegraph(x, z, radius, seconds) {
    let item = telegraphs.find((t) => !t.active);
    if (!item) item = telegraphs.reduce((a, b) => (a.age > b.age ? a : b));
    item.token++;
    item.active = true;
    item.age = 0;
    item.seconds = Math.max(0.05, seconds);
    item.radius = radius;
    for (const mesh of [item.outline, item.fill, item.front]) {
      mesh.position.set(x, FLOOR_Y, z);
      mesh.visible = true;
    }
    item.outline.scale.set(radius, 1, radius);
    updateTelegraph(item, 0);
    const token = item.token;
    return {
      cancel() {
        if (item.token === token && item.active) hideTelegraph(item);
      },
      get done() {
        return item.token !== token || !item.active;
      },
    };
  }

  function updateTelegraph(item, dt) {
    item.age += dt;
    const t = item.age;
    if (t < item.seconds) {
      const p = t / item.seconds;
      const r = Math.max(0.01, item.radius * (0.08 + 0.92 * p));
      const pulse = 0.5 + 0.5 * Math.sin(t * (10 + 18 * p));
      item.fill.scale.set(r, 1, r);
      item.front.scale.set(r, 1, r);
      item.fill.material.uniforms.uOpacity.value = 0.55 + 0.3 * p;
      item.fill.material.uniforms.uTime.value = t;
      item.front.material.opacity = 0.9;
      item.outline.material.opacity = 0.6 + 0.4 * pulse;
      return;
    }
    // 다 참: 한 번 번쩍하고 사라짐
    const q = (t - item.seconds) / TELEGRAPH_FADE;
    if (q >= 1) {
      hideTelegraph(item);
      return;
    }
    item.fill.scale.set(item.radius, 1, item.radius);
    item.front.scale.set(item.radius, 1, item.radius);
    item.fill.material.uniforms.uOpacity.value = 0.9 * (1 - q);
    item.front.material.opacity = 0.9 * (1 - q);
    item.outline.material.opacity = 0.9 * (1 - q);
  }

  function hideTelegraph(item) {
    item.active = false;
    item.outline.visible = false;
    item.fill.visible = false;
    item.front.visible = false;
  }

  function update(dt) {
    for (let i = 0; i < rings.length; i++) if (rings[i].active) updateRing(rings[i], dt);
    for (let i = 0; i < telegraphs.length; i++) if (telegraphs[i].active) updateTelegraph(telegraphs[i], dt);
  }

  function clear() {
    for (const item of rings) {
      item.active = false;
      if (item.mesh) item.mesh.visible = false;
    }
    for (const item of telegraphs) hideTelegraph(item);
  }

  return { ring, telegraph, update, clear };
}
