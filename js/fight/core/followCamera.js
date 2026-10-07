// 따라가는 카메라 (위에서 비스듬히 내려다보며 내 토끼를 부드럽게 따라감)
// 카메라 방향은 고정입니다: 화면 위쪽 = -z, 오른쪽 = +x. 내려다보는 각도는 fightConfig.js 의 camera.pitchDeg.
// 화면 비율(가로/세로)이 바뀌어도 내 토끼 둘레로 땅이 '좌우 minHalfWidth 칸, 앞뒤 minHalfDepth 칸' 이상
// 꼭 보이도록 카메라 거리를 저절로 정합니다. (휴대폰 세로·가로, 컴퓨터 모두)
// 조준하는 쪽으로 화면을 조금 미리 옮기고(aimLead), 큰 일이 생기면 화면이 흔들립니다(shake).
//
//   const view = createFollowCamera(camera, element, FIGHT.camera)    element: 그림이 그려지는 캔버스(또는 그 상자)
//   view.update(dt, { target: Vector3, aimDir: { x, z } | null })     매 장면. aimDir 길이가 1 보다 작으면 그만큼만 미리 옮김
//   view.screenToGround(clientX, clientY, 높이 = 0, out?) → Vector3 | null   화면 위 점 → 그 높이의 땅(평면) 위치
//   view.worldToScreen(위치, out?) → { x, y, visible }                 세상 위치 → 화면 좌표 (clientX/Y 와 같은 기준)
//   view.shake(세기)                                                   화면 흔들기 (겹치면 커지고, 최대 shakeMax)
//   view.kick({ x, z }, 세기)                                          화면을 그 방향 반대로 살짝 톡 (총 반동 등, 없어도 됨)
//   view.snapTo(target)                                                부드럽게 가지 않고 바로 그 자리로 (다시 하기)
//   view.distance / view.look / view.extent                            지금 카메라 거리 / 바라보는 땅 위치 / 보이는 땅 범위 (확인용)
//
// 전장 가장자리에서는 화면이 전장 밖(울타리 너머)을 너무 많이 비추지 않게 카메라가 멈춥니다.
// (내 토끼는 그래도 늘 화면 안쪽에 머뭄) 끄려면 createFollowCamera(…, { bounds: null }).
//   네 번째 인자 { bounds = 전장 크기, edgeMargin = EDGE_MARGIN }
//
// 따라가는 빠르기·미리 옮기는 거리·흔들림 세기는 fightConfig.js 의 camera 에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { FIGHT } from '../fightConfig.js';

const DEG = Math.PI / 180;
const LOOK_HEIGHT = 4 * FIGHT.figureScale; // 땅이 아니라 이 높이(토끼 배쯤)를 화면 가운데에 둠 → 키 큰 토끼가 화면 가운데에 보임
const LEAD_FOLLOW = 0.55; // 조준 쪽으로 미리 옮기는 것은 따라가기보다 이만큼 느리게 (조준이 휙휙 바뀌어도 어지럽지 않게)
const SHAKE_DECAY = 6.5; // 흔들림이 줄어드는 빠르기
const KICK_DECAY = 14; // '톡' 밀림이 돌아오는 빠르기
const KICK_MAX = 1.2; // '톡' 밀림 최대 거리 (칸)
const FIT_EDGE = 1; // 화면 끝까지 쓰기 (1 = 끝까지, 0.95 = 5% 여유)
const EDGE_MARGIN = 5; // 전장 가장자리에서 울타리 바깥이 이만큼(칸)까지만 보이게 카메라를 멈춤
const BODY_HEIGHT = 18 * FIGHT.figureScale + 3.5; // 가장자리에서 멈출 때도 내 토끼 발끝~귀 끝(이 높이)이 화면 안에 남게
const BODY_HALF_WIDTH = 5.5 * FIGHT.figureScale; // 내 토끼 좌우 폭 (절반)
const BODY_EDGE = 0.94; // 내 토끼가 화면 끝에서 이만큼 안쪽에 있게 (1 = 화면 끝)
const MAP_BOUNDS = { minX: -FIGHT.map.width / 2, maxX: FIGHT.map.width / 2, minZ: -FIGHT.map.depth / 2, maxZ: FIGHT.map.depth / 2 };

export function createFollowCamera(camera, element, config, { bounds = MAP_BOUNDS, edgeMargin = EDGE_MARGIN } = {}) {
  const pitch = config.pitchDeg * DEG;
  const up = Math.sin(pitch);
  const back = Math.cos(pitch);

  const look = new THREE.Vector3(); // 지금 바라보는 땅 위치 (부드럽게 움직임)
  const goal = new THREE.Vector3();
  const lead = { x: 0, z: 0 };
  const want = { x: 0, z: 0 }; // 이번 장면에 바라보고 싶은 곳 (가장자리에서 멈춤 적용 뒤)
  let started = false;
  let distance = 60;
  const fitFor = { aspect: 0, fov: 0, halfWidth: 0, halfDepth: 0 }; // 이 값들이 그대로면 거리를 다시 계산하지 않음
  // 캔버스 위치·크기: 한 장면에 한 번만 읽음 (글자 띄우기가 여러 번 불러도 화면 배치를 다시 계산하지 않게)
  let rect = null;
  // 바라보는 곳 기준으로 보이는 땅 범위: far(화면 위 끝, 음수) near(화면 아래 끝) side(화면 아래 줄의 좌우 절반 폭)
  const extent = { far: -30, near: 15, side: 20 };

  let shakeAmount = 0;
  let shakeTime = 0;
  const kickOffset = { x: 0, z: 0 };

  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  const projected = new THREE.Vector3();
  const probe = new THREE.PerspectiveCamera();
  const corner = new THREE.Vector3();

  function update(dt, { target = null, aimDir = null } = {}) {
    rect = element.getBoundingClientRect();
    if (target) goal.set(target.x, 0, target.z);

    // 조준 쪽으로 미리 옮길 양
    let lx = 0;
    let lz = 0;
    if (aimDir && (aimDir.x || aimDir.z)) {
      const length = Math.hypot(aimDir.x, aimDir.z);
      const amount = Math.min(1, length) * (config.aimLead ?? 0);
      lx = (aimDir.x / length) * amount;
      lz = (aimDir.z / length) * amount;
    }

    distance = solveDistance();
    // 조준 쪽 미리 옮김은 따라가기보다 조금 더 느리게 바뀜
    if (!started) {
      lead.x = lx;
      lead.z = lz;
    } else {
      const leadRate = 1 - Math.exp(-dt * (config.follow ?? 7) * LEAD_FOLLOW);
      lead.x += (lx - lead.x) * leadRate;
      lead.z += (lz - lead.z) * leadRate;
    }
    want.x = goal.x + lead.x;
    want.z = goal.z + lead.z;
    if (bounds) keepOnMap(want);
    if (!started) {
      look.set(want.x, 0, want.z);
      started = true;
    } else {
      const rate = 1 - Math.exp(-dt * (config.follow ?? 7));
      look.x += (want.x - look.x) * rate;
      look.z += (want.z - look.z) * rate;
    }

    // 흔들림·톡 밀림: 카메라를 돌리지 않고 통째로 옮김 (화면 오른쪽·위쪽 방향으로)
    let sx = 0;
    let sy = 0;
    if (shakeAmount > 0.001) {
      shakeTime += dt;
      const t = shakeTime;
      sx = (Math.sin(t * 47) * 0.6 + Math.sin(t * 83 + 1.1) * 0.4) * shakeAmount;
      sy = (Math.sin(t * 53 + 2.3) * 0.6 + Math.sin(t * 97 + 0.4) * 0.4) * shakeAmount;
      shakeAmount *= Math.exp(-dt * SHAKE_DECAY);
    } else shakeAmount = 0;
    const kickFade = Math.exp(-dt * KICK_DECAY);
    kickOffset.x *= kickFade;
    kickOffset.z *= kickFade;

    // 화면 위쪽 방향(카메라 기준) = (0, cos p, -sin p)
    const ox = look.x + sx + kickOffset.x;
    const oy = LOOK_HEIGHT + sy * back;
    const oz = look.z - sy * up + kickOffset.z;
    camera.position.set(ox, oy + up * distance, oz + back * distance);
    camera.lookAt(ox, oy, oz);
    camera.updateMatrixWorld();
  }

  // 전장 밖이 너무 많이 보이지 않게 바라보는 곳을 옮기되, 내 토끼(goal)는 몸 전체가 화면 안에 남게 함
  function keepOnMap(point) {
    const lowX = bounds.minX - edgeMargin + extent.side;
    const highX = bounds.maxX + edgeMargin - extent.side;
    let x = lowX <= highX ? Math.min(highX, Math.max(lowX, point.x)) : (bounds.minX + bounds.maxX) / 2;
    const lowZ = bounds.minZ - edgeMargin - extent.far;
    const highZ = bounds.maxZ + edgeMargin - extent.near;
    // 화면이 전장보다 세로로 길면(휴대폰 세로) 가까운 쪽(아래) 가장자리에 맞춤 — 먼 쪽은 작게 보이므로
    let z = lowZ <= highZ ? Math.min(highZ, Math.max(lowZ, point.z)) : highZ;
    // 내 토끼 몸이 화면 밖으로 나가면, 내 토끼 쪽으로 되돌아가며 몸이 다 보이는 가장 먼 곳을 찾음
    if (!bodyOnScreen(x, z)) {
      let lo = 0; // 0 = 지금 위치, 1 = 내 토끼 바로 위 (늘 다 보임)
      let hi = 1;
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (bodyOnScreen(x + (goal.x - x) * mid, z + (goal.z - z) * mid)) hi = mid;
        else lo = mid;
      }
      x += (goal.x - x) * hi;
      z += (goal.z - z) * hi;
    }
    point.x = x;
    point.z = z;
  }

  // 바라보는 곳이 (lx, lz) 일 때 내 토끼 발밑·귀 끝·양옆이 화면 안쪽(BODY_EDGE)에 있는지
  function bodyOnScreen(lx, lz) {
    const r = goal.z - lz;
    const xr = goal.x - lx;
    return (
      inside(xr - BODY_HALF_WIDTH, 0, r) && inside(xr + BODY_HALF_WIDTH, 0, r) && inside(xr, BODY_HEIGHT, r) && inside(xr, 0, r + BODY_HALF_WIDTH)
    );
  }

  // 바라보는 땅 위치 기준 (xr 옆, h 높이, r 앞뒤) 인 점이 화면 안쪽에 있는지 (카메라 방향이 고정이라 식으로 바로 계산)
  function inside(xr, h, r) {
    const tanHalf = Math.tan((camera.fov * DEG) / 2);
    const depth = distance + (LOOK_HEIGHT - h) * up - r * back;
    if (depth <= 0) return false;
    const ny = ((h - LOOK_HEIGHT) * back - r * up) / (depth * tanHalf);
    const nx = xr / (depth * tanHalf * camera.aspect);
    return Math.abs(nx) <= BODY_EDGE && Math.abs(ny) <= BODY_EDGE;
  }

  // 화면 비율에 맞춰, 바라보는 곳 둘레 땅 네모(좌우 minHalfWidth, 앞뒤 minHalfDepth)가 다 들어오는 가장 가까운 거리
  function solveDistance() {
    if (fitFor.aspect === camera.aspect && fitFor.fov === camera.fov && fitFor.halfWidth === config.minHalfWidth && fitFor.halfDepth === config.minHalfDepth) return distance;
    probe.fov = camera.fov;
    probe.aspect = camera.aspect;
    probe.near = camera.near;
    probe.far = camera.far;
    probe.updateProjectionMatrix();
    let low = 1;
    let high = 1000;
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2;
      if (fits(mid)) high = mid;
      else low = mid;
    }
    Object.assign(fitFor, { aspect: camera.aspect, fov: camera.fov, halfWidth: config.minHalfWidth, halfDepth: config.minHalfDepth });
    measureExtent(high);
    return high;
  }

  // 그 거리에서 화면 위·아래 끝과 아래 줄 옆 끝이 땅의 어디에 닿는지 (바라보는 곳 기준)
  function measureExtent(d) {
    fits(d); // probe 를 그 자리에 놓음
    const hit = new THREE.Vector3();
    const groundAt = (x, y) => {
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, probe);
      plane.constant = 0;
      return raycaster.ray.intersectPlane(plane, hit);
    };
    extent.far = groundAt(0, 1)?.z ?? -d;
    extent.near = groundAt(0, -1)?.z ?? d * 0.3;
    extent.side = Math.abs(groundAt(1, -1)?.x ?? d * 0.3);
  }

  function fits(d) {
    probe.position.set(0, LOOK_HEIGHT + up * d, back * d);
    probe.lookAt(0, LOOK_HEIGHT, 0);
    probe.updateMatrixWorld();
    for (let i = 0; i < 4; i++) {
      corner.set(i & 1 ? config.minHalfWidth : -config.minHalfWidth, 0, i & 2 ? config.minHalfDepth : -config.minHalfDepth);
      corner.project(probe);
      if (corner.z > 1 || Math.abs(corner.x) > FIT_EDGE || Math.abs(corner.y) > FIT_EDGE) return false;
    }
    return true;
  }

  function screenToGround(clientX, clientY, height = 0, out = null) {
    const box = rect ?? element.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    ndc.set(((clientX - box.left) / box.width) * 2 - 1, -((clientY - box.top) / box.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    plane.constant = -height;
    return raycaster.ray.intersectPlane(plane, out ?? new THREE.Vector3());
  }

  function worldToScreen(point, out = null) {
    const box = rect ?? element.getBoundingClientRect();
    projected.copy(point).project(camera);
    const result = out ?? {};
    result.x = box.left + ((projected.x + 1) / 2) * box.width;
    result.y = box.top + ((1 - projected.y) / 2) * box.height;
    result.visible = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1;
    return result;
  }

  return {
    update,
    screenToGround,
    worldToScreen,
    shake(amount) {
      shakeAmount = Math.min(config.shakeMax ?? 1.4, shakeAmount + Math.max(0, amount));
    },
    kick(dir, amount = 0.3) {
      const length = Math.hypot(dir?.x ?? 0, dir?.z ?? 0);
      if (!length) return;
      kickOffset.x -= (dir.x / length) * amount;
      kickOffset.z -= (dir.z / length) * amount;
      const k = Math.hypot(kickOffset.x, kickOffset.z);
      if (k > KICK_MAX) {
        kickOffset.x *= KICK_MAX / k;
        kickOffset.z *= KICK_MAX / k;
      }
    },
    snapTo(target) {
      if (target) goal.set(target.x, 0, target.z);
      started = false;
    },
    get distance() {
      return distance;
    },
    get look() {
      return look;
    },
    get extent() {
      return extent;
    },
  };
}
