// 소굴 카메라
// 비스듬히 내려다보는 고정 시점입니다. 땅판 전체(테두리 + 앞쪽 바위 몸통 + 뒤쪽 높은 시설 자리)가
// 위 정보판 · 아래 단추 사이의 빈 화면에 꽉 차게, 가운데에 오도록 거리와 자리를 맞춥니다.
// 땅이 넓어지거나 화면 모양 · 가림(insets)이 바뀌면 부드럽게 새 자리로 옮겨 갑니다.
//
//   const view = createLairCamera(camera, element)
//   view.setLand(size, { snap })          땅 크기(칸). snap: true 면 부드럽게 말고 바로
//   view.setInsets({ top, bottom, left, right })   화면 가장자리를 가리는 크기(px)
//   view.setTall([{ height, back }])       뒤쪽 시설 높이 → 꼭대기가 안 잘리게 위 여유를 더 둠 (back: 땅 뒤 끝에서 거리)
//   view.update(dt)                        매 장면 (움직임 + 카메라 놓기)
//   view.snap()                            바로 목표 자리로
//   view.shake(세기)                        살짝 흔들기 (0.1 ~ 0.5)
//   view.pointerRay(clientX, clientY) → THREE.Ray   화면 점에서 나가는 광선 (같은 물건을 돌려 씀)
//   view.worldToScreen(위치, out) → out { x, y }      화면(페이지) 좌표
//   view.moving                            아직 옮겨 가는 중인지
// 놀이하는 사람의 확대 · 옮겨 보기 (lairZoom.js 가 두 손가락 · 휠 · +/- 단추로 부름). 자동으로 맞춘 자리 위에 더해짐
//   view.zoomBy(배, clientX?, clientY?)   배만큼 확대 (1보다 크면 가까이). 화면 점을 주면 그 점이 손가락 아래 그대로
//   view.panBy(dx, dy)                     화면 px 만큼 끌어 옮기기 (확대했을 때만 움직임)
//   view.resetZoom()                       처음 보기로 · view.zoom   지금 확대 배율 (1 = 땅 전체가 딱 맞음)
//
// 보는 각도 · 화면 여유 · 따라가는 빠르기 · 확대 범위는 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { TILE } from './lairKit.js';

const DEG = Math.PI / 180;
const PITCH = 54; // 내려다보는 각도 (클수록 위에서 똑바로)
const FOV = 30; // 시야각 (작을수록 장난감 디오라마처럼 납작)
const RIM = 1.2; // 땅 둘레 테두리 + 여유 (블록)
const MIN_HEADROOM = 4.6; // 뒤쪽 줄 위로 늘 남길 높이 (귀퉁이 횃불). 뒤쪽에 높은 시설이 있으면 setTall 로 더 남김
const MAX_HEADROOM = 16;
const FRONT_DROP = 3; // 앞쪽 바위 몸통에서 화면에 꼭 넣을 깊이 (그 아래 늘어진 바위는 단추 뒤로 가도 됨)
const MARGIN_X = 0.035; // 화면 양옆 여유 (-1 ~ 1 기준)
const MARGIN_Y = 0.045; // 화면 위아래 여유
const EASE_RATE = 3.2; // 새 자리로 옮겨 가는 빠르기
const SHAKE_DECAY = 8;
const ZOOM_MIN = 0.85; // 놀이하는 사람이 줄일 수 있는 한도 (1 = 땅 전체가 딱 맞음)
const ZOOM_MAX = 2.8; // 키울 수 있는 한도
const PAN_SPARE = 0.15; // 확대했을 때 땅 끝보다 조금 더(땅 반 너비의 이만큼) 옮겨 볼 수 있음

export function createLairCamera(camera, element) {
  camera.fov = FOV;
  camera.near = 1;
  camera.far = 1500;
  camera.updateProjectionMatrix();
  const pitch = PITCH * DEG;
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, Math.cos(pitch), -Math.sin(pitch));
  const forward = new THREE.Vector3(0, -Math.sin(pitch), -Math.cos(pitch));
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  let land = 8;
  let key = '';
  let headroom = MIN_HEADROOM;
  let lastW = 0;
  let lastH = 0;
  const goal = { a: 0, b: 0, d: 120 };
  const current = { a: 0, b: 0, d: 120 };
  let needSnap = true;
  let shakeAmount = 0;
  let shakeTime = 0;
  const user = { zoom: 1, a: 0, b: 0 }; // 놀이하는 사람이 바꾼 확대 · 옮기기
  const points = [];
  for (let i = 0; i < 10; i++) points.push(new THREE.Vector3());
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const projected = new THREE.Vector3();

  function fillPoints() {
    const half = (land * TILE) / 2 + RIM;
    let k = 0;
    for (const sx of [-1, 1]) {
      points[k++].set(sx * half, 0, -half);
      points[k++].set(sx * half, 0, half);
      points[k++].set(sx * half, headroom, -half);
      points[k++].set(sx * half, -FRONT_DROP, half);
    }
    points[k++].set(0, headroom, -half);
    points[k++].set(0, -FRONT_DROP - 1, half);
  }

  // 점 p 가 카메라 화면 안에 들어오려면: 화면 오른쪽 방향 a, 위 방향 b, 거리 d 가 일차 부등식을 만족해야 함
  // → 거리 d 를 반씩 줄여 가며 가로 · 세로 모두 들어오는 가장 가까운 d 를 찾고, a · b 는 남는 범위의 가운데로
  function solve() {
    const w = Math.max(1, element.clientWidth || 1);
    const h = Math.max(1, element.clientHeight || 1);
    const next = [w, h, land, headroom, insets.top, insets.bottom, insets.left, insets.right].join('|');
    if (next === key) return;
    if (lastW < 8 || lastH < 8) needSnap = true; // 숨어 있다가(크기 0) 나타나면 미끄러지지 말고 바로
    lastW = w;
    lastH = h;
    key = next;
    fillPoints();
    const tanY = Math.tan((FOV * DEG) / 2);
    const tanX = tanY * (w / h);
    const L = -1 + (2 * insets.left) / w + MARGIN_X;
    const R = 1 - (2 * insets.right) / w - MARGIN_X;
    const B = -1 + (2 * insets.bottom) / h + MARGIN_Y;
    const T = 1 - (2 * insets.top) / h - MARGIN_Y;
    const span = (d, axis, kk, lo, hi) => {
      let min = -Infinity;
      let max = Infinity;
      for (const p of points) {
        const z = p.dot(forward) + d;
        const s = p.dot(axis);
        min = Math.max(min, s - hi * kk * z);
        max = Math.min(max, s - lo * kk * z);
      }
      return [min, max];
    };
    const fits = (d) => {
      const x = span(d, right, tanX, L, R);
      const y = span(d, up, tanY, B, T);
      return x[0] <= x[1] && y[0] <= y[1];
    };
    let lo = 1;
    let hi = 4000;
    if (R - L < 0.1 || T - B < 0.1) hi = 4000;
    else for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    const [xa, xb] = span(hi, right, tanX, L, R);
    const [ya, yb] = span(hi, up, tanY, B, T);
    goal.a = Number.isFinite(xa + xb) ? (xa + xb) / 2 : 0;
    goal.b = Number.isFinite(ya + yb) ? (ya + yb) / 2 : 0;
    goal.d = hi;
  }

  // 확대했을 때 옮길 수 있는 범위 (땅 밖으로 너무 나가지 않게)
  function clampPan() {
    const half = (land * TILE) / 2 + RIM;
    const room = Math.max(0, 1 - 1 / user.zoom) + (user.zoom > 1 ? PAN_SPARE : 0);
    const maxA = half * room;
    const maxB = half * Math.sin(pitch) * room;
    user.a = Math.max(-maxA, Math.min(maxA, user.a));
    user.b = Math.max(-maxB, Math.min(maxB, user.b));
    if (user.zoom <= 1) user.a = user.b = 0;
  }

  // 화면 점(-1 ~ 1)이 그대로 있도록 확대 → 카메라를 그 점 쪽으로 옮김
  function zoomBy(factor, clientX = null, clientY = null) {
    const before = user.zoom;
    user.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, user.zoom * factor));
    const k = user.zoom / before;
    if (k !== 1 && clientX !== null) {
      const rect = element.getBoundingClientRect();
      const nx = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      const ny = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      const d = current.d / before;
      const tanY = Math.tan((FOV * DEG) / 2);
      user.a += nx * tanY * camera.aspect * d * (1 - 1 / k);
      user.b += ny * tanY * d * (1 - 1 / k);
    }
    clampPan();
  }

  function panBy(dx, dy) {
    const rect = element.getBoundingClientRect();
    const d = current.d / user.zoom;
    const tanY = Math.tan((FOV * DEG) / 2);
    user.a -= (dx / Math.max(1, rect.width)) * 2 * tanY * camera.aspect * d;
    user.b += (dy / Math.max(1, rect.height)) * 2 * tanY * d;
    clampPan();
  }

  function place() {
    const d = current.d / user.zoom;
    camera.position.copy(right).multiplyScalar(current.a + user.a).addScaledVector(up, current.b + user.b).addScaledVector(forward, -d);
    if (shakeAmount > 0.001) {
      camera.position.x += Math.sin(shakeTime * 61) * shakeAmount;
      camera.position.y += Math.sin(shakeTime * 47 + 1.3) * shakeAmount * 0.6;
    }
    projected.copy(camera.position).add(forward);
    camera.lookAt(projected);
    camera.updateMatrixWorld();
  }

  function update(dt) {
    const w = Math.max(1, element.clientWidth || 1);
    const h = Math.max(1, element.clientHeight || 1);
    if (Math.abs(camera.aspect - w / h) > 1e-4) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    solve();
    if (needSnap) {
      Object.assign(current, goal);
      needSnap = false;
    } else {
      const k = 1 - Math.exp(-dt * EASE_RATE);
      current.a += (goal.a - current.a) * k;
      current.b += (goal.b - current.b) * k;
      current.d += (goal.d - current.d) * k;
    }
    if (shakeAmount > 0.001) {
      shakeTime += dt;
      shakeAmount *= Math.exp(-dt * SHAKE_DECAY);
    }
    place();
  }

  function pointerRay(clientX, clientY) {
    const rect = element.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1, -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray;
  }

  function worldToScreen(point, out = { x: 0, y: 0 }) {
    const rect = element.getBoundingClientRect();
    projected.copy(point).project(camera);
    out.x = rect.left + ((projected.x + 1) / 2) * rect.width;
    out.y = rect.top + ((1 - projected.y) / 2) * rect.height;
    return out;
  }

  return {
    update,
    pointerRay,
    worldToScreen,
    setLand(size, { snap = false } = {}) {
      land = size;
      if (snap) needSnap = true;
      clampPan();
    },
    // 뒤쪽 시설 높이 [{ height, back }] (back: 땅 뒤 끝에서 그 시설 뒤 끝까지 거리, 블록) → 꼭대기가 화면 밖으로 안 잘리게 위 여유
    setTall(list) {
      let need = MIN_HEADROOM;
      const slope = Math.tan(pitch);
      for (const t of list) need = Math.max(need, t.height + 1 - t.back * slope);
      headroom = Math.min(MAX_HEADROOM, Math.round(need * 2) / 2);
    },
    setInsets({ top = 0, bottom = 0, left = 0, right: r = 0 } = {}) {
      insets.top = Math.max(0, Math.round(top));
      insets.bottom = Math.max(0, Math.round(bottom));
      insets.left = Math.max(0, Math.round(left));
      insets.right = Math.max(0, Math.round(r));
    },
    snap() {
      needSnap = true;
      update(0);
    },
    shake(amount = 0.2) {
      shakeAmount = Math.min(0.8, shakeAmount + amount);
    },
    get moving() {
      return Math.abs(goal.d - current.d) > 0.05 || Math.abs(goal.a - current.a) > 0.02 || Math.abs(goal.b - current.b) > 0.02;
    },
    zoomBy,
    panBy,
    resetZoom() {
      user.zoom = 1;
      user.a = user.b = 0;
    },
    get zoom() {
      return user.zoom;
    },
  };
}
