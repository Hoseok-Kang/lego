// 계책 줄 (켜진 계책으로 이어진 시설 사이를 빛 알갱이가 무지개다리처럼 흘러감)
// 계책 단계마다 색이 다릅니다: 1단계 라임, 2단계 분홍, 3단계 금빛. 줄 양 끝 시설 위에는 빛 구슬이 둥실.
// 지을 자리를 고르는 동안: 새로 켜질 계책 줄은 밝은 초록으로 빠르게, 꺼질 계책 줄은 빨갛게 깜빡입니다.
//
//   const links = createLairLinks(parent)
//   links.setSchemes(evaluation)                  evaluation.schemes[].links 로 줄 만들기
//   links.setPreview(gained, lost)                미리보기 줄 [[idA, idB, tier?]] (없으면 빈 목록)
//   links.focus(id | null)                        이 시설이 낀 줄만 밝게 (나머지는 흐리게)
//   links.pulse(key)                              그 계책 줄을 잠깐 번쩍
//   links.update(dt, time, anchor)                anchor(id, out) → out | null : 시설 지붕 위 자리
//   links.dispose()
//
// 알갱이 수 · 크기 · 흐르는 빠르기 · 색은 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { createGlowPointMaterial } from './lairFxArt.js';

const DOTS = 20; // 줄 하나의 빛 알갱이 수
const DOT_SIZE = 1.8;
const NODE_SIZE = 3.4; // 끝 구슬 크기
const FLOW = 0.45; // 흐르는 빠르기 (초당 줄 길이 비율)
const ARC = 2.2; // 줄이 위로 휘는 높이 (+ 길이의 일부)
const TIER_COLORS = { 1: '#BBE90B', 2: '#FF698F', 3: '#FFF03A' };
const GAIN_COLOR = '#7CFF4F';
const LOST_COLOR = '#FF3B2F';
const MAX_LINKS = 64;
const MAX_POINTS = MAX_LINKS * (DOTS + 2);

export function createLairLinks(parent) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX_POINTS * 3);
  const col = new Float32Array(MAX_POINTS * 3);
  const size = new Float32Array(MAX_POINTS);
  const alpha = new Float32Array(MAX_POINTS);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);
  const attrs = Object.values(geo.attributes);
  const material = createGlowPointMaterial();
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 6;
  parent.add(points);

  // 줄 목록: { a, b, color: Color, key, kind: 0 켜짐 | 1 새로 켜질 | 2 꺼질, seed }
  const links = [];
  const preview = [];
  const flash = new Map(); // 계책 key → 남은 번쩍 시간
  let focusId = null;
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  const nodeSeen = new Set();

  function setSchemes(evaluation) {
    links.length = 0;
    for (const s of evaluation?.schemes ?? []) {
      const color = new THREE.Color(TIER_COLORS[s.tier] ?? TIER_COLORS[1]);
      for (const [a, b] of s.links ?? []) {
        if (links.length >= MAX_LINKS) break;
        links.push({ a, b, color, key: s.key, kind: 0, seed: (a * 7 + b * 13) % 10 });
      }
    }
  }

  function setPreview(gained = [], lost = []) {
    preview.length = 0;
    const gain = new THREE.Color(GAIN_COLOR);
    const bad = new THREE.Color(LOST_COLOR);
    for (const [a, b] of gained) preview.push({ a, b, color: gain, key: '', kind: 1, seed: 0 });
    for (const [a, b] of lost) preview.push({ a, b, color: bad, key: '', kind: 2, seed: 0 });
  }

  let n = 0;
  function push(x, y, z, c, s, a) {
    if (n >= MAX_POINTS) return;
    pos[n * 3] = x;
    pos[n * 3 + 1] = y;
    pos[n * 3 + 2] = z;
    col[n * 3] = c.r;
    col[n * 3 + 1] = c.g;
    col[n * 3 + 2] = c.b;
    size[n] = s;
    alpha[n] = a;
    n++;
  }

  function drawLink(link, time, anchor, dim) {
    if (!anchor(link.a, pa) || !anchor(link.b, pb)) return;
    const dx = pb.x - pa.x;
    const dz = pb.z - pa.z;
    const len = Math.hypot(dx, dz);
    const lift = Math.max(pa.y, pb.y) + ARC + len * 0.18;
    const midY = 2 * lift - (pa.y + pb.y) / 2; // 이차 곡선 조절점 (꼭대기가 lift 에 오도록)
    const boost = flash.has(link.key) ? 1 + flash.get(link.key) * 2.5 : 1;
    const speed = link.kind === 1 ? FLOW * 2.2 : FLOW;
    let a = dim ? 0.28 : 0.9;
    if (link.kind === 2) a = 0.35 + 0.55 * (Math.sin(time * 14) > 0 ? 1 : 0.2);
    if (link.kind === 1) a = 1;
    for (let k = 0; k < DOTS; k++) {
      let u = (k + time * speed * DOTS + link.seed * 0.37) / DOTS;
      u -= Math.floor(u);
      const v = 1 - u;
      const x = v * v * pa.x + 2 * v * u * (pa.x + dx / 2) + u * u * pb.x;
      const y = v * v * pa.y + 2 * v * u * midY + u * u * pb.y;
      const z = v * v * pa.z + 2 * v * u * (pa.z + dz / 2) + u * u * pb.z;
      const middle = Math.sin(Math.PI * u);
      push(x, y, z, link.color, DOT_SIZE * (0.55 + 0.6 * middle) * Math.min(2, boost), a * (0.35 + 0.65 * middle));
    }
    // 끝 구슬
    node(link.a, pa, link, time, boost, dim);
    node(link.b, pb, link, time, boost, dim);
  }

  // 시설 위 빛 구슬 (같은 시설 위에 여러 번 그리지 않게)
  function node(id, p, link, time, boost, dim) {
    const key = id * 4 + link.kind;
    if (nodeSeen.has(key)) return;
    nodeSeen.add(key);
    const beat = 0.8 + 0.2 * Math.sin(time * 3 + id);
    push(p.x, p.y + Math.sin(time * 2 + id) * 0.25, p.z, link.color, NODE_SIZE * beat * Math.min(1.8, boost), dim ? 0.3 : 0.85);
  }

  function update(dt, time, anchor) {
    if (flash.size) {
      for (const [key, t] of flash) {
        const left = t - dt / 1.6;
        if (left <= 0) flash.delete(key);
        else flash.set(key, left);
      }
    }
    n = 0;
    nodeSeen.clear();
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const dim = focusId !== null && link.a !== focusId && link.b !== focusId;
      drawLink(link, time, anchor, dim);
    }
    for (let i = 0; i < preview.length; i++) drawLink(preview[i], time, anchor, false);
    geo.setDrawRange(0, n);
    for (let k = 0; k < attrs.length; k++) attrs[k].needsUpdate = true;
  }

  return {
    setSchemes,
    setPreview,
    update,
    focus(id) {
      focusId = id ?? null;
    },
    pulse(key) {
      flash.set(key, 1);
    },
    setPixelScale(value) {
      material.uniforms.scale.value = value;
    },
    dispose() {
      parent.remove(points);
      geo.dispose();
      material.dispose();
    },
  };
}
