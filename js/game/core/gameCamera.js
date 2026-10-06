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

import * as THREE from '../../lib/three.js';

const DEG = Math.PI / 180;
const TAP_MOVE_PX = 8;
const TAP_MS = 450;

export function createGameCamera(camera, element, config) {
  const pitch = config.pitchDeg * DEG;
  const target = new THREE.Vector3(0, 1.5, 0);
  const goal = { yaw: config.yawDeg * DEG, zoom: 1 };
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
    const follow = 1 - Math.exp(-dt * 10);
    current.yaw += (goal.yaw - current.yaw) * follow;
    current.zoom += (goal.zoom - current.zoom) * follow;

    const distance = fitDistance() * current.zoom;
    const cosPitch = Math.cos(pitch);
    camera.position.set(
      target.x + Math.sin(current.yaw) * cosPitch * distance,
      target.y + Math.sin(pitch) * distance,
      target.z + Math.cos(current.yaw) * cosPitch * distance,
    );
    camera.lookAt(target);

    if (shakeAmount > 0.001) {
      shakeTime += dt;
      const s = shakeAmount;
      camera.position.x += Math.sin(shakeTime * 61) * s;
      camera.position.y += Math.sin(shakeTime * 47 + 1.3) * s * 0.6;
      shakeAmount *= Math.exp(-dt * 7);
    }
  }

  // 전장 원(반지름 fitRadius)이 화면 가로·세로에 다 들어오는 거리
  function fitDistance() {
    const halfV = Math.tan((camera.fov * DEG) / 2);
    const halfH = halfV * camera.aspect;
    const radius = config.fitRadius;
    const needV = (radius * Math.sin(pitch) + 4) / halfV;
    const needH = radius / halfH;
    return Math.max(needV, needH);
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
    resetView() {
      goal.yaw = config.yawDeg * DEG;
      goal.zoom = 1;
    },
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
