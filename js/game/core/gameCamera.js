// 게임 카메라
// 전장 전체가 화면에 들어오게 위에서 비스듬히 내려다봅니다.
// 화면을 좌우로 끌면 성 둘레를 돌아보고, 휠이나 두 손가락으로 확대/축소합니다.
// 살짝 눌렀다 떼면(탭) 그 자리의 땅 위치를 알려 줍니다. (타워 짓기에 씀)
//
//   camera.update(dt)
//   camera.onTap(({ point, clientX, clientY }) => ...)   point: 땅 위 위치 (없으면 null)
//   camera.worldToScreen(위치) → { x, y, visible }      화면 위 좌표 (글자 띄우기, 메뉴 위치에 씀)
//   camera.yaw                                         지금 돌아간 각도 (블록 인형이 카메라를 보게 할 때 씀)
//   camera.shake(세기)                                  화면 흔들기
//   camera.setFitRadius(반지름)                          화면에 다 들어오게 맞출 땅 크기(절반) (땅이 넓어지면 천천히 물러남)
//   camera.setInsets({ top, bottom })                   위쪽 정보판·아래쪽 단추가 가리는 높이(px) → 그 사이에 전장이 들어오게 맞춤

import * as THREE from '../../lib/three.js';

const DEG = Math.PI / 180;
const TAP_MOVE_PX = 8;
const TAP_MS = 450;

export function createGameCamera(camera, element, config) {
  // 세로로 긴 화면(휴대폰)에서는 더 위에서 내려다봐서 전장이 화면을 더 채우게 함
  const portraitPitch = (config.portraitPitchDeg ?? config.pitchDeg) * DEG;
  let pitch = config.pitchDeg * DEG;
  const target = new THREE.Vector3(0, 1.5, 0);
  const aim = new THREE.Vector3(); // 실제로 바라보는 곳 (빈 화면 가운데에 전장이 오도록 앞뒤로 조금 옮김)
  const insets = { top: 0, bottom: 0 };
  let fit = { key: '', distance: 50, shift: 0 };
  const goal = { yaw: config.yawDeg * DEG, zoom: 1, fitRadius: config.fitRadius ?? 30 };
  const current = { ...goal };
  let shakeAmount = 0;
  let shakeTime = 0;

  const tapHandlers = new Set();
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const projected = new THREE.Vector3();

  function update(dt) {
    const wantPitch = camera.aspect < 0.8 ? portraitPitch : config.pitchDeg * DEG;
    pitch += (wantPitch - pitch) * (1 - Math.exp(-dt * 6));
    const follow = 1 - Math.exp(-dt * 10);
    current.yaw += (goal.yaw - current.yaw) * follow;
    current.zoom += (goal.zoom - current.zoom) * follow;
    current.fitRadius += (goal.fitRadius - current.fitRadius) * (1 - Math.exp(-dt * 2));

    const solved = solveFit();
    const distance = solved.distance * current.zoom;
    const cosPitch = Math.cos(pitch);
    // 카메라 쪽(앞)으로 shift 만큼 옮긴 곳을 바라봄
    aim.set(
      target.x + Math.sin(current.yaw) * solved.shift,
      target.y,
      target.z + Math.cos(current.yaw) * solved.shift,
    );
    camera.position.set(
      aim.x + Math.sin(current.yaw) * cosPitch * distance,
      aim.y + Math.sin(pitch) * distance,
      aim.z + Math.cos(current.yaw) * cosPitch * distance,
    );
    camera.lookAt(aim);

    if (shakeAmount > 0.001) {
      shakeTime += dt;
      const s = shakeAmount;
      camera.position.x += Math.sin(shakeTime * 61) * s;
      camera.position.y += Math.sin(shakeTime * 47 + 1.3) * s * 0.6;
      shakeAmount *= Math.exp(-dt * 7);
    }
  }

  // 정사각형 땅(절반 크기 fitRadius)의 네 모서리가 위쪽 정보판과 아래쪽 단추 사이 빈 화면에 다 들어오고,
  // 먼 쪽 땅끝에 선 큰 몬스터 머리도 화면 안에 남는 가장 가까운 거리와 앞뒤 옮김(shift)을 찾음.
  // 거의 같은 크기로 보이는 방법이 여럿이면 빈 화면의 위아래 여백이 비슷한(가운데에 오는) 쪽을 고름
  const probe = new THREE.PerspectiveCamera();
  const corner = new THREE.Vector3();
  const FAR_HEIGHT = 14; // 먼 쪽 땅끝에 서 있는 대장 키만큼 위쪽 여유
  const EDGE_X = 0.97; // 화면 양옆 여유 (1 = 끝까지)
  const SCREEN_TOP = 0.98; // 큰 몬스터 머리는 위쪽 정보판 뒤로는 가도 화면 밖으로는 안 나가게
  const SHIFT_STEPS = 12; // 앞뒤 옮김을 몇 단계로 나눠 시험할지 (한쪽 방향)
  const SIZE_TOLERANCE = 1.03; // 가운데에 오게 하려고 이만큼까지는 조금 작게 보여도 됨
  function solveFit() {
    const radius = current.fitRadius;
    const height = Math.max(1, element.clientHeight || 1);
    const key = [radius.toFixed(2), camera.aspect.toFixed(3), camera.fov, pitch.toFixed(3), current.yaw.toFixed(2), insets.top, insets.bottom, height].join('|');
    if (key === fit.key) return fit;
    const top = 1 - (2 * insets.top) / height - 0.02;
    const bottom = -1 + (2 * insets.bottom) / height + 0.02;
    probe.fov = camera.fov;
    probe.aspect = camera.aspect;
    probe.near = camera.near;
    probe.far = camera.far;
    probe.updateProjectionMatrix();
    const candidates = [];
    for (let k = -SHIFT_STEPS; k <= SHIFT_STEPS; k++) {
      const shift = (k / SHIFT_STEPS) * radius * 0.45;
      let low = radius * 0.3;
      let high = radius * 8;
      if (!fits(high, shift, radius, top, bottom)) continue;
      for (let i = 0; i < 22; i++) {
        const mid = (low + high) / 2;
        if (fits(mid, shift, radius, top, bottom)) high = mid;
        else low = mid;
      }
      const extent = groundExtent(high, shift, radius);
      candidates.push({ distance: high, shift, imbalance: Math.abs(top - extent.max - (extent.min - bottom)) });
    }
    let best = { distance: radius * 3, shift: 0 };
    if (candidates.length > 0) {
      const nearest = Math.min(...candidates.map((c) => c.distance));
      const good = candidates.filter((c) => c.distance <= nearest * SIZE_TOLERANCE);
      good.sort((a, b) => a.imbalance - b.imbalance || a.distance - b.distance);
      best = good[0];
    }
    fit = { key, distance: best.distance, shift: best.shift };
    return fit;
  }

  // 시험용 카메라를 (거리, 앞뒤 옮김) 자리에 놓음
  function placeProbe(distance, shift) {
    const cosPitch = Math.cos(pitch);
    const sx = Math.sin(current.yaw);
    const cz = Math.cos(current.yaw);
    const ax = target.x + sx * shift;
    const az = target.z + cz * shift;
    probe.position.set(ax + sx * cosPitch * distance, target.y + Math.sin(pitch) * distance, az + cz * cosPitch * distance);
    probe.lookAt(ax, target.y, az);
    probe.updateMatrixWorld();
  }

  function fits(distance, shift, radius, top, bottom) {
    placeProbe(distance, shift);
    const sx = Math.sin(current.yaw);
    const cz = Math.cos(current.yaw);
    for (let i = 0; i < 4; i++) {
      const x = i & 1 ? radius : -radius;
      const z = i & 2 ? radius : -radius;
      // 땅 모서리
      corner.set(x, 0, z).project(probe);
      if (corner.z > 1 || Math.abs(corner.x) > EDGE_X || corner.y < bottom || corner.y > top) return false;
      // 먼 쪽 모서리 위에 서 있는 큰 몬스터 머리
      const away = x * sx + z * cz; // 카메라 반대쪽(음수)일수록 먼 쪽
      if (away < 0) {
        corner.set(x, FAR_HEIGHT, z).project(probe);
        if (corner.y > SCREEN_TOP) return false;
      }
    }
    return true;
  }

  // 땅 네 모서리가 화면에서 차지하는 위아래 범위 (-1 ~ 1)
  function groundExtent(distance, shift, radius) {
    placeProbe(distance, shift);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 4; i++) {
      corner.set(i & 1 ? radius : -radius, 0, i & 2 ? radius : -radius).project(probe);
      min = Math.min(min, corner.y);
      max = Math.max(max, corner.y);
    }
    return { min, max };
  }

  function screenToGround(clientX, clientY) {
    const rect = element.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(groundPlane, hit) ? hit.clone() : null;
  }

  function worldToScreen(point) {
    const rect = element.getBoundingClientRect();
    projected.copy(point).project(camera);
    return {
      x: rect.left + ((projected.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - projected.y) / 2) * rect.height,
      visible: projected.z < 1 && Math.abs(projected.x) <= 1.1 && Math.abs(projected.y) <= 1.1,
    };
  }

  // ── 마우스/터치 ──
  const pointers = new Map();
  let pinchDistance = 0;
  let press = null;
  element.style.touchAction = 'none';

  element.addEventListener('pointerdown', (event) => {
    element.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    press = pointers.size === 1 ? { x: event.clientX, y: event.clientY, time: performance.now(), moved: false } : null;
    if (pointers.size === 2) pinchDistance = currentPinchDistance();
  });

  element.addEventListener('pointermove', (event) => {
    const last = pointers.get(event.pointerId);
    if (!last) return;
    const dx = event.clientX - last.x;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_MOVE_PX) press.moved = true;
    if (pointers.size === 1 && press?.moved) {
      goal.yaw -= dx * 0.006;
    } else if (pointers.size === 2) {
      const distanceNow = currentPinchDistance();
      if (pinchDistance > 0) goal.zoom = clamp((goal.zoom * pinchDistance) / distanceNow, config.minZoom, config.maxZoom);
      pinchDistance = distanceNow;
    }
  });

  const release = (event) => {
    const wasTap =
      press && !press.moved && pointers.size === 1 && performance.now() - press.time < TAP_MS && event.type === 'pointerup';
    pointers.delete(event.pointerId);
    pinchDistance = pointers.size === 2 ? currentPinchDistance() : 0;
    if (wasTap) {
      const point = screenToGround(event.clientX, event.clientY);
      for (const handler of tapHandlers) handler({ point, clientX: event.clientX, clientY: event.clientY });
    }
    if (pointers.size === 0) press = null;
  };
  element.addEventListener('pointerup', release);
  // 휴대폰에서 탭하면 손가락을 뗀 뒤 '클릭'이 한 번 더 생기는데, 그 사이 뜬 메뉴 버튼이 눌리지 않게 막음
  element.addEventListener(
    'touchend',
    (event) => {
      if (event.cancelable) event.preventDefault();
    },
    { passive: false },
  );
  element.addEventListener('pointercancel', release);

  element.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      goal.zoom = clamp(goal.zoom * Math.exp(event.deltaY * 0.001), config.minZoom, config.maxZoom);
    },
    { passive: false },
  );

  function currentPinchDistance() {
    const [a, b] = Array.from(pointers.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  update(0);

  return {
    update,
    onTap: (handler) => tapHandlers.add(handler),
    screenToGround,
    worldToScreen,
    shake: (strength) => {
      shakeAmount = Math.min(1.2, shakeAmount + strength);
    },
    get yaw() {
      return current.yaw;
    },
    setInsets({ top = 0, bottom = 0 } = {}) {
      insets.top = Math.round(top);
      insets.bottom = Math.round(bottom);
    },
    setFitRadius(radius, { instant = false } = {}) {
      goal.fitRadius = radius;
      if (instant) current.fitRadius = radius;
    },
    resetView() {
      goal.yaw = config.yawDeg * DEG;
      goal.zoom = 1;
    },
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
