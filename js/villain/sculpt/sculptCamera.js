// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 3D 작업대: 빙 둘러보는 카메라
// 상자 가운데를 바라보며 옆으로 돌기(yaw) · 위아래로 기울기(pitch) · 가까이/멀리(거리)를 바꿉니다.
//
// 쓰는 법
//   const cam = createSculptCamera({ w, h, d, center })
//   cam.camera (THREE.PerspectiveCamera)
//   cam.setAspect(가로 ÷ 세로) ; cam.rotate(dx, dy) 픽셀만큼 돌리기 ; cam.zoom(배율) 1 보다 크면 가까이
//   cam.reset() 처음 각도로 ; cam.turn(라디안) 옆으로 돌기 ; cam.apply() 카메라에 적용 (바꾼 뒤 한 번)
//
// 처음 각도 · 돌리는 빠르기 · 가까이 갈 수 있는 한계는 아래 상수에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import * as THREE from '../../lib/three.js';

const START_YAW = -0.55; // 처음 옆으로 돈 각도 (라디안. 0 = 정면)
const START_PITCH = 0.42; // 처음 내려다보는 각도
const PITCH_RANGE = [-0.15, 1.35];
const TURN_PER_PIXEL = 0.009;
const ZOOM_RANGE = [0.45, 2.2]; // 처음 거리의 몇 배까지 (작을수록 가까이)
const FOV = 34;

export function createSculptCamera({ w, h, d, center }) {
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.3, 300);
  let yaw = START_YAW;
  let pitch = START_PITCH;
  let scale = 1; // 거리 배율
  let aspect = 1;

  // 상자 전체가 들어오는 거리
  function fitDistance() {
    const radius = Math.hypot(w, h, d) / 2;
    const half = Math.tan((FOV * Math.PI) / 360);
    const fitH = radius / half;
    const fitW = radius / (half * Math.min(1, aspect));
    return Math.max(fitH, fitW) * 1.02;
  }

  function apply() {
    const dist = fitDistance() * scale;
    camera.aspect = aspect;
    camera.position.set(
      center.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      center.y + Math.sin(pitch) * dist,
      center.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }

  return {
    camera,
    setAspect(value) {
      aspect = Math.max(0.2, value || 1);
    },
    rotate(dx, dy) {
      yaw -= dx * TURN_PER_PIXEL;
      pitch = Math.min(PITCH_RANGE[1], Math.max(PITCH_RANGE[0], pitch + dy * TURN_PER_PIXEL));
    },
    turn(amount) {
      yaw += amount;
    },
    zoom(factor) {
      scale = Math.min(ZOOM_RANGE[1], Math.max(ZOOM_RANGE[0], scale / factor));
    },
    reset() {
      yaw = START_YAW;
      pitch = START_PITCH;
      scale = 1;
    },
    apply,
  };
}
