// 소굴 효과 (블록 조각 · 블록 연기 · 반짝이 · 불티 · 땅 위 빛 고리 · 떠오르는 글자)
// 모든 효과는 미리 만들어 둔 묶음(블록 700개, 빛 점 1600개, 고리 10개, 글자 4장)을 돌려 씁니다 → 매 장면 새 물건을 만들지 않음.
//
//   const fx = createLairFx(scene)
//   fx.block(x, y, z, vx, vy, vz, 색, { life, size, gravity, spin, grow })   블록 조각 하나 (grow: 커졌다 작아지는 연기 블록)
//   fx.pop(x, y, z, 색, 세기)          블록이 '퐁' 튀어 나감 (팔기·강화)
//   fx.dust(x, y, z, 개수, 색?)        땅에 닿을 때 흙먼지 블록
//   fx.smoke(x, y, z, 색)              굴뚝 연기 블록 하나
//   fx.sparkle(x, y, z, 개수, 색, { spread, up, life, size, gravity })   반짝이 빛 점
//   fx.ember(x, y, z, 색?)             위로 날아오르는 불티 하나
//   fx.ring(x, y, z, 색, { radius, life })   땅 위로 퍼지는 빛 고리
//   fx.label(x, y, z, 글자, 색)         위로 떠오르는 큰 글자 (계책 이름)
//   fx.update(dt)   fx.busy (블록·빛 점이 남았는지)   fx.dispose()
//   fx.setPixelScale(값)               빛 점 크기 맞추기 (화면 높이 px ÷ (2 × tan(시야각/2)))
//
// 효과 크기 · 개수는 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { getBlockAssets } from '../../game/core/blockAssets.js';
import { getLairMaterials } from './lairKit.js';

const MAX_BLOCKS = 700;
const MAX_POINTS = 1600;
const MAX_RINGS = 10;
const MAX_LABELS = 4;
const GRAVITY = 30;
const LABEL_HEIGHT = 0.034; // 글자 높이 (화면 높이에 대한 비율의 약 1/2)

export function createLairFx(scene) {
  const mats = getLairMaterials();
  const { block } = getBlockAssets();

  // ── 블록 조각 ──
  const blocks = new THREE.InstancedMesh(block, mats.solid, MAX_BLOCKS);
  blocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  blocks.frustumCulled = false;
  blocks.castShadow = false;
  blocks.count = 0;
  blocks.setColorAt(0, new THREE.Color(1, 1, 1));
  scene.add(blocks);
  const B = {
    pos: new Float32Array(MAX_BLOCKS * 3),
    vel: new Float32Array(MAX_BLOCKS * 3),
    rot: new Float32Array(MAX_BLOCKS * 3),
    spin: new Float32Array(MAX_BLOCKS * 3),
    life: new Float32Array(MAX_BLOCKS),
    max: new Float32Array(MAX_BLOCKS),
    size: new Float32Array(MAX_BLOCKS),
    grav: new Float32Array(MAX_BLOCKS),
    grow: new Uint8Array(MAX_BLOCKS),
    color: new Float32Array(MAX_BLOCKS * 3),
    count: 0,
  };
  const B3 = [B.pos, B.vel, B.rot, B.spin, B.color]; // 칸 3개짜리 표 (지울 때 한꺼번에 옮김)

  // ── 빛 점 (반짝이 · 불티) ──
  const pointGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAX_POINTS * 3);
  const pCol = new Float32Array(MAX_POINTS * 3);
  const pSize = new Float32Array(MAX_POINTS);
  const pAlpha = new Float32Array(MAX_POINTS);
  pointGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
  pointGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3).setUsage(THREE.DynamicDrawUsage));
  pointGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1).setUsage(THREE.DynamicDrawUsage));
  pointGeo.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  pointGeo.setDrawRange(0, 0);
  const pointAttrs = Object.values(pointGeo.attributes);
  const pointMat = createGlowPointMaterial();
  const points = new THREE.Points(pointGeo, pointMat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  scene.add(points);
  const P = {
    vel: new Float32Array(MAX_POINTS * 3),
    life: new Float32Array(MAX_POINTS),
    max: new Float32Array(MAX_POINTS),
    size: new Float32Array(MAX_POINTS),
    grav: new Float32Array(MAX_POINTS),
    drag: new Float32Array(MAX_POINTS),
    count: 0,
  };

  // ── 빛 고리 ──
  const ringTex = makeRingTexture();
  const rings = [];
  for (let i = 0; i < MAX_RINGS; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.renderOrder = 4;
    mesh.userData = { life: 0, max: 1, radius: 4 };
    scene.add(mesh);
    rings.push(mesh);
  }

  // ── 떠오르는 글자 ──
  const labels = [];
  for (let i = 0; i < MAX_LABELS; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    sprite.renderOrder = 20;
    sprite.userData = { canvas, tex, life: 0, max: 1, y0: 0, aspect: 4 };
    scene.add(sprite);
    labels.push(sprite);
  }

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const vpos = new THREE.Vector3();
  const vscl = new THREE.Vector3();
  const color = new THREE.Color();

  function blockFx(x, y, z, vx, vy, vz, hex, { life = 1.2, size = 1, gravity = 1, spin = 6, grow = false } = {}) {
    if (B.count >= MAX_BLOCKS) return;
    const i = B.count++;
    B.pos[i * 3] = x;
    B.pos[i * 3 + 1] = y;
    B.pos[i * 3 + 2] = z;
    B.vel[i * 3] = vx;
    B.vel[i * 3 + 1] = vy;
    B.vel[i * 3 + 2] = vz;
    for (let k = 0; k < 3; k++) {
      B.rot[i * 3 + k] = Math.random() * 0.5;
      B.spin[i * 3 + k] = (Math.random() - 0.5) * spin;
    }
    B.life[i] = 0;
    B.max[i] = life;
    B.size[i] = size;
    B.grav[i] = gravity;
    B.grow[i] = grow ? 1 : 0;
    color.set(hex);
    B.color[i * 3] = color.r;
    B.color[i * 3 + 1] = color.g;
    B.color[i * 3 + 2] = color.b;
  }

  function pointFx(x, y, z, vx, vy, vz, hex, life, size, gravity, drag) {
    if (P.count >= MAX_POINTS) return;
    const i = P.count++;
    pPos[i * 3] = x;
    pPos[i * 3 + 1] = y;
    pPos[i * 3 + 2] = z;
    P.vel[i * 3] = vx;
    P.vel[i * 3 + 1] = vy;
    P.vel[i * 3 + 2] = vz;
    color.set(hex);
    pCol[i * 3] = color.r;
    pCol[i * 3 + 1] = color.g;
    pCol[i * 3 + 2] = color.b;
    P.life[i] = 0;
    P.max[i] = life;
    P.size[i] = size;
    P.grav[i] = gravity;
    P.drag[i] = drag;
  }

  function sparkle(x, y, z, count, hex, { spread = 1.5, up = 6, life = 0.9, size = 0.9, gravity = 0.25 } = {}) {
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      pointFx(
        x + Math.cos(a) * r * 0.3,
        y + Math.random() * 0.5,
        z + Math.sin(a) * r * 0.3,
        Math.cos(a) * r * 2.2,
        up * (0.4 + Math.random() * 0.8),
        Math.sin(a) * r * 2.2,
        hex,
        life * (0.6 + Math.random() * 0.6),
        size * (0.6 + Math.random() * 0.8),
        gravity,
        1.8,
      );
    }
  }

  function update(dt) {
    // 블록 조각
    for (let i = 0; i < B.count; i++) {
      B.life[i] += dt;
      if (B.life[i] >= B.max[i]) {
        removeBlock(i);
        i--;
        continue;
      }
      const g = B.grav[i] * GRAVITY;
      B.vel[i * 3 + 1] -= g * dt;
      if (B.grow[i]) {
        const damp = Math.exp(-dt * 1.2);
        B.vel[i * 3] *= damp;
        B.vel[i * 3 + 2] *= damp;
      }
      for (let k = 0; k < 3; k++) {
        B.pos[i * 3 + k] += B.vel[i * 3 + k] * dt;
        B.rot[i * 3 + k] += B.spin[i * 3 + k] * dt;
      }
      const t = B.life[i] / B.max[i];
      const s = B.grow[i] ? B.size[i] * Math.sin(Math.PI * Math.min(1, t * 1.1)) * (0.6 + t) : B.size[i] * (t > 0.75 ? (1 - t) / 0.25 : 1);
      euler.set(B.rot[i * 3], B.rot[i * 3 + 1], B.rot[i * 3 + 2]);
      quat.setFromEuler(euler);
      vpos.set(B.pos[i * 3], B.pos[i * 3 + 1], B.pos[i * 3 + 2]);
      vscl.setScalar(Math.max(0.001, s));
      matrix.compose(vpos, quat, vscl);
      blocks.setMatrixAt(i, matrix);
      color.setRGB(B.color[i * 3], B.color[i * 3 + 1], B.color[i * 3 + 2]);
      blocks.setColorAt(i, color);
    }
    blocks.count = B.count;
    if (B.count) {
      blocks.instanceMatrix.needsUpdate = true;
      blocks.instanceColor.needsUpdate = true;
    }
    // 빛 점
    for (let i = 0; i < P.count; i++) {
      P.life[i] += dt;
      if (P.life[i] >= P.max[i]) {
        removePoint(i);
        i--;
        continue;
      }
      const damp = Math.exp(-dt * P.drag[i]);
      P.vel[i * 3] *= damp;
      P.vel[i * 3 + 2] *= damp;
      P.vel[i * 3 + 1] = P.vel[i * 3 + 1] * damp - P.grav[i] * GRAVITY * dt;
      for (let k = 0; k < 3; k++) pPos[i * 3 + k] += P.vel[i * 3 + k] * dt;
      const t = P.life[i] / P.max[i];
      pAlpha[i] = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      pSize[i] = P.size[i] * (1 - t * 0.5);
    }
    pointGeo.setDrawRange(0, P.count);
    if (P.count) {
      for (let k = 0; k < pointAttrs.length; k++) pointAttrs[k].needsUpdate = true;
    }
    // 고리
    for (const ring of rings) {
      if (!ring.visible) continue;
      const u = ring.userData;
      u.life += dt;
      const t = u.life / u.max;
      if (t >= 1) {
        ring.visible = false;
        continue;
      }
      const r = u.radius * (0.25 + 0.75 * (1 - Math.pow(1 - t, 3)));
      ring.scale.set(r, r, 1);
      ring.material.opacity = 1 - t;
    }
    // 글자
    for (const sprite of labels) {
      if (!sprite.visible) continue;
      const u = sprite.userData;
      u.life += dt;
      const t = u.life / u.max;
      if (t >= 1) {
        sprite.visible = false;
        continue;
      }
      const pop = t < 0.12 ? easeOutBack(t / 0.12) : 1;
      sprite.position.y = u.y0 + (1 - Math.pow(1 - t, 2)) * 4;
      const h = LABEL_HEIGHT * pop;
      sprite.scale.set(h * u.aspect, h, 1);
      sprite.material.opacity = t > 0.75 ? (1 - t) / 0.25 : 1;
    }
  }

  function removeBlock(i) {
    const last = --B.count;
    if (i === last) return;
    for (let k = 0; k < B3.length; k++) {
      const arr = B3[k];
      arr[i * 3] = arr[last * 3];
      arr[i * 3 + 1] = arr[last * 3 + 1];
      arr[i * 3 + 2] = arr[last * 3 + 2];
    }
    B.life[i] = B.life[last];
    B.max[i] = B.max[last];
    B.size[i] = B.size[last];
    B.grav[i] = B.grav[last];
    B.grow[i] = B.grow[last];
  }

  function removePoint(i) {
    const last = --P.count;
    if (i === last) return;
    for (let k = 0; k < 3; k++) {
      pPos[i * 3 + k] = pPos[last * 3 + k];
      pCol[i * 3 + k] = pCol[last * 3 + k];
      P.vel[i * 3 + k] = P.vel[last * 3 + k];
    }
    pSize[i] = pSize[last];
    pAlpha[i] = pAlpha[last];
    P.life[i] = P.life[last];
    P.max[i] = P.max[last];
    P.size[i] = P.size[last];
    P.grav[i] = P.grav[last];
    P.drag[i] = P.drag[last];
  }

  return {
    block: blockFx,
    pop(x, y, z, hex, power = 1) {
      const a = Math.random() * Math.PI * 2;
      const out = (2 + Math.random() * 4) * power;
      blockFx(x, y, z, Math.cos(a) * out, (7 + Math.random() * 7) * power, Math.sin(a) * out, hex, { life: 0.9 + Math.random() * 0.5, spin: 10 });
    },
    dust(x, y, z, count = 4, hex = '#6C6E68') {
      for (let n = 0; n < count; n++) {
        const a = Math.random() * Math.PI * 2;
        const v = 1.5 + Math.random() * 2.5;
        blockFx(x, y + 0.2, z, Math.cos(a) * v, 0.6 + Math.random(), Math.sin(a) * v, hex, { life: 0.5 + Math.random() * 0.3, size: 0.35 + Math.random() * 0.25, gravity: -0.02, spin: 3, grow: true });
      }
    },
    smoke(x, y, z, hex = '#A0A5A9') {
      blockFx(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.5, 2 + Math.random(), (Math.random() - 0.5) * 0.4, hex, {
        life: 1.8 + Math.random() * 0.6,
        size: 0.55 + Math.random() * 0.3,
        gravity: 0,
        spin: 1.5,
        grow: true,
      });
    },
    sparkle,
    ember(x, y, z, hex = '#FE8A18') {
      pointFx(x, y, z, (Math.random() - 0.5) * 1.2, 2.5 + Math.random() * 2.5, (Math.random() - 0.5) * 1.2, hex, 1.1 + Math.random() * 0.9, 0.45 + Math.random() * 0.35, -0.02, 0.6);
    },
    ring(x, y, z, hex, { radius = 5, life = 0.8 } = {}) {
      const ring = rings.find((r) => !r.visible) ?? rings[0];
      ring.visible = true;
      ring.position.set(x, y, z);
      ring.material.color.set(hex);
      Object.assign(ring.userData, { life: 0, max: life, radius });
      ring.scale.set(0.01, 0.01, 1);
    },
    label(x, y, z, text, hex = '#BBE90B') {
      const sprite = labels.find((s) => !s.visible) ?? labels[0];
      const u = sprite.userData;
      u.aspect = drawLabel(u.canvas, text, hex);
      u.tex.needsUpdate = true;
      u.life = 0;
      u.max = 2.2;
      u.y0 = y;
      sprite.position.set(x, y, z);
      sprite.visible = true;
      sprite.scale.set(0.001, 0.001, 1);
    },
    update,
    setPixelScale(value) {
      pointMat.uniforms.scale.value = value;
    },
    get busy() {
      return B.count > 0 || P.count > 0;
    },
    dispose() {
      scene.remove(blocks, points);
      blocks.dispose();
      pointGeo.dispose();
      pointMat.dispose();
      ringTex.dispose();
      for (const r of rings) {
        scene.remove(r);
        r.geometry.dispose();
        r.material.dispose();
      }
      for (const s of labels) {
        scene.remove(s);
        s.userData.tex.dispose();
        s.material.dispose();
      }
    },
  };
}

// 빛 점 재질: 동그랗게 번지는 빛 (더하기 섞기). 크기는 블록 단위 → 멀리 있으면 작게
export function createGlowPointMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { scale: { value: 600 } },
    vertexShader: `
      attribute vec3 color; attribute float size; attribute float alpha;
      uniform float scale;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.5, size * scale / -mv.z);
        gl_Position = projectionMatrix * mv;
        vColor = color; vAlpha = alpha;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, d);
        float core = pow(a, 5.0);
        a = a * a * vAlpha;
        gl_FragColor = vec4((vColor + vec3(core * 0.8)) * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// 글자 그림: 굵은 글자 + 짙은 보라 테두리 + 양옆 별. 가로세로 비율을 돌려줌
function drawLabel(canvas, text, hex) {
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.font = '64px "Jua", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  const width = Math.min(canvas.width - 20, g.measureText(text).width + 110);
  const x0 = (canvas.width - width) / 2;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 14;
  g.strokeStyle = '#1b0f33';
  g.strokeText(text, canvas.width / 2, 68);
  g.fillStyle = hex;
  g.fillText(text, canvas.width / 2, 68);
  g.fillStyle = '#FFF03A';
  for (const x of [x0 + 26, x0 + width - 26]) star(g, x, 64, 20);
  return canvas.width / canvas.height;
}

function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.lineWidth = 6;
  g.strokeStyle = '#1b0f33';
  g.stroke();
  g.fill();
}

function makeRingTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function easeOutBack(t) {
  const c = 1.9;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}
