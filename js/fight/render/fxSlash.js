// 칼 휘두르기 자국 (반투명한 부채꼴 띠)
// 칼을 휘두르면 칼끝이 지나간 자리에 하얀 띠가 '휙' 하고 그려졌다가 금방 사라집니다.
// 띠 모양은 그래픽 카드에서 바로 계산해서, 휘두를 때마다 새 모양을 만들지 않습니다.
//
//   const slashes = createSlashes(scene, { count = 6 })
//   slashes.spawn(x, y, z, facing, 부채꼴각도, 닿는거리, 방향 ±1)
//       방향 +1: 오른쪽 → 왼쪽으로 휘두름 (토끼 기준), -1: 반대
//   slashes.update(dt) ; slashes.clear()
//
// 색·길이·사라지는 빠르기는 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';

const SLASH_SECONDS = 0.2; // 띠가 보이는 전체 시간
const SWEEP_SECONDS = 0.11; // 띠 앞머리가 끝까지 가는 시간
const INNER = 0.34; // 띠 안쪽 끝 (닿는 거리에 대한 비율)
const TRAIL = 0.6; // 띠 꼬리 길이 (부채꼴 전체에 대한 비율)
const BODY_HEX = '#E1D5ED'; // 띠 색 (연보라빛 흰색)
const EDGE_HEX = '#F4F4F4'; // 띠 바깥 테두리 색 (흰색)
const SEGMENTS = 28;

const vertexShader = /* glsl */ `
  uniform float uStart;
  uniform float uArc;
  uniform float uInner;
  uniform float uOuter;
  varying vec2 vUv;
  void main() {
    float a = uStart + position.x * uArc;
    float r = mix(uInner, uOuter, position.y);
    vec3 p = vec3(sin(a) * r, position.y * 0.6, cos(a) * r);
    vUv = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uHead;
  uniform float uFade;
  uniform float uTrail;
  uniform vec3 uColor;
  uniform vec3 uEdge;
  varying vec2 vUv;
  void main() {
    float d = uHead - vUv.x;
    if (d < 0.0) discard;
    float tail = 1.0 - smoothstep(0.0, uTrail, d);
    float inner = smoothstep(0.0, 0.35, vUv.y);
    float edge = smoothstep(0.72, 0.97, vUv.y);
    vec3 color = mix(uColor, uEdge, edge);
    float alpha = tail * inner * uFade * (0.72 + 0.28 * edge);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSlashes(scene, { count = 6 } = {}) {
  const geometry = buildStrip(SEGMENTS);
  const bodyColor = new THREE.Color(BODY_HEX);
  const edgeColor = new THREE.Color(EDGE_HEX);
  const pool = [];
  for (let i = 0; i < count; i++) {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uStart: { value: 0 },
        uArc: { value: 1 },
        uInner: { value: 1 },
        uOuter: { value: 2 },
        uHead: { value: 0 },
        uFade: { value: 1 },
        uTrail: { value: TRAIL },
        uColor: { value: bodyColor },
        uEdge: { value: edgeColor },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = 4;
    mesh.name = 'fxSlash';
    scene.add(mesh);
    pool.push({ mesh, uniforms: material.uniforms, age: 0, active: false });
  }
  let next = 0;

  function spawn(x, y, z, facing, arc, range, side) {
    const item = pool[next];
    next = (next + 1) % pool.length;
    const dir = side < 0 ? -1 : 1;
    item.uniforms.uStart.value = -dir * arc * 0.5;
    item.uniforms.uArc.value = dir * arc;
    item.uniforms.uInner.value = range * INNER;
    item.uniforms.uOuter.value = range;
    item.uniforms.uHead.value = 0;
    item.uniforms.uFade.value = 1;
    item.mesh.position.set(x, y, z);
    item.mesh.rotation.set(0, facing, 0);
    item.mesh.visible = true;
    item.age = 0;
    item.active = true;
  }

  function update(dt) {
    for (let i = 0; i < pool.length; i++) {
      const item = pool[i];
      if (!item.active) continue;
      item.age += dt;
      const t = item.age;
      if (t >= SLASH_SECONDS) {
        item.active = false;
        item.mesh.visible = false;
        continue;
      }
      const sweep = Math.min(1, t / SWEEP_SECONDS);
      // 앞머리는 빠르게 출발해서 끝에서 살짝 느려짐, 끝까지 가면 꼬리가 따라와 사라짐
      item.uniforms.uHead.value = 1 - (1 - sweep) * (1 - sweep) + Math.max(0, t - SWEEP_SECONDS) * 4;
      item.uniforms.uFade.value = t < SWEEP_SECONDS ? 1 : 1 - (t - SWEEP_SECONDS) / (SLASH_SECONDS - SWEEP_SECONDS);
    }
  }

  function clear() {
    for (const item of pool) {
      item.active = false;
      item.mesh.visible = false;
    }
  }

  return { spawn, update, clear };
}

// 띠 모양: x = 부채꼴을 따라가는 비율(0~1), y = 안쪽(0) → 바깥(1)
function buildStrip(segments) {
  const rows = [0, 0.55, 0.85, 1];
  const positions = [];
  const indices = [];
  for (let s = 0; s <= segments; s++) {
    for (const v of rows) positions.push(s / segments, v, 0);
  }
  const stride = rows.length;
  for (let s = 0; s < segments; s++) {
    for (let r = 0; r < stride - 1; r++) {
      const a = s * stride + r;
      const b = (s + 1) * stride + r;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}
