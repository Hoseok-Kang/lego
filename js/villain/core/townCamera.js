// 마을 카메라
// 위에서 비스듬히 내려다보는 고정 시점입니다. 마을 바닥판 전체가 위쪽 정보판·아래쪽 단추 사이 빈 화면에 들어오게 거리를 맞추고,
// '볼거리'(괴수, 싸움)를 정해 주면 그쪽으로 살짝 다가갑니다. 다가가도 바닥판 밖은 되도록 보이지 않게 움직임을 묶어 둡니다.
// 세로로 긴 화면(휴대폰)에서는 마을이 너무 작아 보이므로, 볼거리가 있으면 마을 세로가 화면에 찰 만큼 다가가 좌우로 따라다닙니다.
//
//   const view = createTownCamera(camera, element, { width, depth, pitchDeg })
//   view.update(dt)                              매 장면 (움직임 계산 + 카메라 놓기)
//   view.setInsets({ top, bottom, left, right }) 정보판·단추가 가리는 크기(px) → 그 사이에 마을이 들어오게 맞춤
//   view.setFocus(위치 | null, 확대 = 1)          볼거리 위치와 다가갈 정도 (1 = 마을 전체, 1.5 = 1.5배 가까이). null = 마을 전체
//   view.snap()                                  부드럽게 따라가지 않고 바로 그 자리로
//   view.shake(세기)                              화면 흔들기 (0.2 살짝 ~ 1 크게)
//   view.worldToScreen(위치) → { x, y, visible } 화면 위 좌표 (떠오르는 글자 위치에 씀)
//   view.zoom                                    지금 확대 정도
//
// 따라가는 빠르기·흔들림 세기·휴대폰 확대 한도는 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';

const DEG = Math.PI / 180;
const LOOK_HEIGHT = 1.5; // 바라보는 높이 (칸)
const FAR_HEIGHT = 20; // 뒤쪽 줄 높은 탑 꼭대기만큼 위쪽 여유 (화면 밖으로 잘리지 않게)
const EDGE_X = 0.97; // 화면 양옆 여유 (1 = 끝까지)
const SCREEN_TOP = 0.98; // 높은 건물 꼭대기는 정보판 뒤로는 가도 화면 밖으로는 안 나가게
const SHIFT_STEPS = 12; // 앞뒤 옮김을 몇 단계로 나눠 시험할지 (한쪽 방향)
const SIZE_TOLERANCE = 1.03; // 가운데에 오게 하려고 이만큼까지는 조금 작게 보여도 됨
const PORTRAIT_FILL = 0.92; // 세로 화면: 마을 세로가 빈 화면을 이만큼 채울 때까지 더 다가감 (1 = 꽉)
const PORTRAIT_PAN_Z = 0.75; // 세로 화면에서 볼거리를 앞뒤로 따라가는 정도 (0 = 안 따라감, 1 = 바닥판 끝까지)
const PORTRAIT_BODY_LIFT = 3; // 세로 화면: 발밑이 아니라 몸통이 가운데에 오도록 이만큼(칸) 뒤쪽을 봄
const MAX_PORTRAIT_BOOST = 2.1; // 세로 화면에서 더 다가가는 한도 (배)
const MAX_ZOOM = 3.2; // 가장 가까이 다가갈 수 있는 한도 (배)
const FOLLOW_RATE = 2.6; // 볼거리를 따라가는 빠르기 (클수록 빨리)
const ZOOM_RATE = 1.7; // 다가가고 물러나는 빠르기
const SHAKE_DECAY = 7; // 흔들림이 잦아드는 빠르기
const SHAKE_SIZE = 0.9; // 세기 1 일 때 흔들리는 크기 (칸)
const MAX_SHAKE = 1.2;

export function createTownCamera(camera, element, { width = 64, depth = 44, pitchDeg = 48 } = {}) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const pitch = pitchDeg * DEG;
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  let fit = { key: '', distance: 120, shift: 0, fillX: 1, fillZ: 1, slideX: 0 };

  const goal = { x: 0, z: 0, zoom: 1, active: false };
  const current = { x: 0, z: 0, zoom: 1 };
  let needSnap = true;
  let shakeAmount = 0;
  let shakeTime = 0;

  const probe = new THREE.PerspectiveCamera();
  const corner = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const projected = new THREE.Vector3();

  // ── 마을 전체가 빈 화면에 들어오는 가장 가까운 거리 찾기 ──
  function placeProbe(distance, shift) {
    probe.position.set(0, LOOK_HEIGHT + Math.sin(pitch) * distance, shift + Math.cos(pitch) * distance);
    probe.lookAt(0, LOOK_HEIGHT, shift);
    probe.updateMatrixWorld();
  }

  // 화면 안 빈 곳의 범위 (-1 ~ 1)
  function freeRect() {
    const w = Math.max(1, element.clientWidth || 1);
    const h = Math.max(1, element.clientHeight || 1);
    return {
      top: 1 - (2 * insets.top) / h - 0.02,
      bottom: -1 + (2 * insets.bottom) / h + 0.02,
      left: -EDGE_X + (2 * insets.left) / w,
      right: EDGE_X - (2 * insets.right) / w,
    };
  }

  function fits(distance, shift, rect, checkX, checkY) {
    placeProbe(distance, shift);
    for (let i = 0; i < 4; i++) {
      const x = i & 1 ? halfW : -halfW;
      const z = i & 2 ? halfD : -halfD;
      corner.set(x, 0, z).project(probe);
      if (corner.z > 1) return false;
      if (checkX && (corner.x < rect.left || corner.x > rect.right)) return false;
      if (checkY && (corner.y < rect.bottom || corner.y > rect.top)) return false;
      if (checkY && z < 0) {
        corner.set(x, FAR_HEIGHT, z).project(probe);
        if (corner.y > SCREEN_TOP) return false;
      }
    }
    return true;
  }

  function nearest(shift, rect, checkX, checkY) {
    let low = 8;
    let high = 1200;
    if (!fits(high, shift, rect, checkX, checkY)) return Infinity;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (fits(mid, shift, rect, checkX, checkY)) high = mid;
      else low = mid;
    }
    return high;
  }

  function groundExtent(distance, shift) {
    placeProbe(distance, shift);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 4; i++) {
      corner.set(i & 1 ? halfW : -halfW, 0, i & 2 ? halfD : -halfD).project(probe);
      min = Math.min(min, corner.y);
      max = Math.max(max, corner.y);
    }
    return { min, max };
  }

  function solveFit() {
    const w = element.clientWidth || 1;
    const h = element.clientHeight || 1;
    const key = [camera.aspect.toFixed(4), camera.fov, w, h, insets.top, insets.bottom, insets.left, insets.right].join('|');
    if (key === fit.key) return fit;
    probe.fov = camera.fov;
    probe.aspect = camera.aspect;
    probe.near = camera.near;
    probe.far = 5000;
    probe.updateProjectionMatrix();
    const rect = freeRect();
    const candidates = [];
    for (let k = -SHIFT_STEPS; k <= SHIFT_STEPS; k++) {
      const shift = (k / SHIFT_STEPS) * halfD * 0.9;
      const distance = nearest(shift, rect, true, true);
      if (!Number.isFinite(distance)) continue;
      const extent = groundExtent(distance, shift);
      candidates.push({ distance, shift, imbalance: Math.abs(rect.top - extent.max - (extent.min - rect.bottom)) });
    }
    let best = { distance: Math.max(width, depth) * 3, shift: 0 };
    if (candidates.length > 0) {
      const closest = Math.min(...candidates.map((c) => c.distance));
      const good = candidates.filter((c) => c.distance <= closest * SIZE_TOLERANCE);
      good.sort((a, b) => a.imbalance - b.imbalance || a.distance - b.distance);
      best = good[0];
    }
    // 가로만 / 세로만 맞출 때의 거리 → 얼마나 다가가면 화면이 꽉 차는지 (그보다 더 다가가야 그 방향으로 움직일 수 있음)
    const onlyX = nearest(best.shift, rect, true, false);
    const onlyY = nearest(best.shift, rect, false, true);
    // 좌우 가림(insets.left/right)이 다르면 빈 화면 가운데에 오도록 옆으로 조금 옮김
    const slideNdc = (rect.left + rect.right) / 2;
    const slideX = -slideNdc * Math.tan((camera.fov * DEG) / 2) * camera.aspect * best.distance;
    fit = {
      key,
      distance: best.distance,
      shift: best.shift,
      slideX,
      fillX: Number.isFinite(onlyX) ? Math.max(1, best.distance / onlyX) : 1,
      fillZ: Number.isFinite(onlyY) ? Math.max(1, best.distance / onlyY) : 1,
    };
    return fit;
  }

  // 볼거리가 있을 때의 실제 확대 (세로 화면이면 마을 세로가 찰 만큼 더)
  function wantedZoom(solved) {
    if (!goal.active) return 1;
    const boost = Math.min(MAX_PORTRAIT_BOOST, Math.max(1, solved.fillZ * PORTRAIT_FILL));
    return Math.min(MAX_ZOOM, Math.max(1, goal.zoom * boost));
  }

  function update(dt) {
    const solved = solveFit();
    const zoomGoal = wantedZoom(solved);
    if (needSnap) {
      current.x = goal.x;
      current.z = goal.z;
      current.zoom = zoomGoal;
      needSnap = false;
    } else {
      const follow = 1 - Math.exp(-dt * FOLLOW_RATE);
      current.x += (goal.x - current.x) * follow;
      current.z += (goal.z - current.z) * follow;
      current.zoom += (zoomGoal - current.zoom) * (1 - Math.exp(-dt * ZOOM_RATE));
    }
    const zoom = current.zoom;
    // 다가간 만큼만 볼거리 쪽으로 옮길 수 있음 (바닥판 밖이 화면에 들어오지 않게)
    const roomX = halfW * Math.max(0, 1 - solved.fillX / zoom);
    const portrait = goal.active && solved.fillZ > solved.fillX;
    let roomZ = halfD * Math.max(0, 1 - solved.fillZ / zoom);
    // 세로 화면: 위아래로 남는 자리가 많으므로 볼거리가 빈 화면 가운데에 오도록 앞뒤로도 따라감 (바닥판 밖 잔디가 조금 보여도 괜찮음)
    if (portrait) roomZ = Math.max(roomZ, halfD * PORTRAIT_PAN_Z * Math.max(0, 1 - solved.fillX / zoom));
    const panX = clamp(current.x, -roomX, roomX);
    const panZ = clamp(current.z - (portrait ? PORTRAIT_BODY_LIFT : 0), -roomZ, roomZ);
    const distance = solved.distance / zoom;
    aim.set(panX + solved.slideX / zoom, LOOK_HEIGHT, panZ + solved.shift / zoom);
    camera.position.set(aim.x, aim.y + Math.sin(pitch) * distance, aim.z + Math.cos(pitch) * distance);
    camera.lookAt(aim);

    if (shakeAmount > 0.001) {
      shakeTime += dt;
      const s = (shakeAmount * SHAKE_SIZE) / Math.sqrt(zoom);
      camera.position.x += Math.sin(shakeTime * 61) * s;
      camera.position.y += Math.sin(shakeTime * 47 + 1.3) * s * 0.6;
      shakeAmount *= Math.exp(-dt * SHAKE_DECAY);
    }
    camera.updateMatrixWorld();
  }

  function worldToScreen(point) {
    const rect = element.getBoundingClientRect();
    projected.copy(point).project(camera);
    return {
      x: rect.left + ((projected.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - projected.y) / 2) * rect.height,
      visible: projected.z < 1 && Math.abs(projected.x) <= 1.05 && Math.abs(projected.y) <= 1.05,
    };
  }

  update(0);

  return {
    update,
    worldToScreen,
    setInsets({ top = 0, bottom = 0, left = 0, right = 0 } = {}) {
      insets.top = Math.round(top);
      insets.bottom = Math.round(bottom);
      insets.left = Math.round(left);
      insets.right = Math.round(right);
    },
    setFocus(point, zoom = 1) {
      if (!point) {
        goal.active = false;
        goal.x = 0;
        goal.z = 0;
        goal.zoom = 1;
        return;
      }
      goal.active = true;
      goal.x = point.x;
      goal.z = point.z;
      goal.zoom = Math.max(1, zoom);
    },
    snap() {
      needSnap = true;
      update(0);
    },
    shake(strength = 0.3) {
      shakeAmount = Math.min(MAX_SHAKE, shakeAmount + strength);
    },
    get zoom() {
      return current.zoom;
    },
    get fit() {
      return solveFit();
    },
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
