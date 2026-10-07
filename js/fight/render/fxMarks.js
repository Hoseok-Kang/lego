// 머리 위 '!' 표시와 조준 점선
// 미친토끼가 나를 발견하면 머리 위에 블록으로 만든 빨간 '!' 가 뿅 튀어나와 통통 흔들립니다.
// 내 토끼가 조준하는 쪽으로는 흐릿한 점선이 그려집니다. (책상 컴퓨터용, 없어도 됨)
//
//   const marks = createMarks(scene, { pitchDeg })
//   marks.alert(followFn, 초, 올림 = ALERT_LIFT)   followFn() → Vector3 : '!' 아래쪽이 떠 있을 자리
//                                   바닥 위치(y < 1, 예: fighter.position)를 주면 '올림' 칸만큼 머리 위로 올려 줌
//                                   (큰 토끼는 올림 = ALERT_LIFT × 크기 로 주면 됨)
//                                   followFn() 이 null 을 돌려주면 그 장면에는 숨김 (예: 토끼가 터짐)
//                                   '!' 블록 크기는 fightConfig.js 의 figureScale 을 따라감 (토끼가 작으면 '!' 도 작게)
//   marks.aimLine(from, to, 보이기)  from → to 점선 (매 장면 불러 줌, 보이기 false 면 숨김)
//   marks.update(dt) ; marks.clear()

import * as THREE from '../../lib/three.js';
import { getBlockAssets } from '../../game/core/blockAssets.js';
import { FIGHT } from '../fightConfig.js';

const ALERT_HEX = '#C91A09'; // '!' 색 (빨강)
const ALERT_SHINE_HEX = '#FF698F'; // '!' 위쪽 반짝 색 (코랄)
const ALERT_BLOCK = 1.2 * (FIGHT.figureScale ?? 1); // '!' 블록 하나 크기 (토끼 크기에 맞춤: 0.5 → 0.6칸, '!' 키 약 3.6칸)
const ALERT_LIFT = 19; // 바닥 위치를 받았을 때 머리 위로 올리는 높이
const ALERT_POP = 0.22; // 뿅 튀어나오는 시간
const ALERT_HIDE = 0.16; // 작아지며 사라지는 시간
const ALERT_COUNT = 8;
// '!' 모양: 아래부터 [높이 칸] (3 = 틈)
const ALERT_SHAPE = [0, 2, 3, 4, 5];

const AIM_HEX = '#F4F4F4';
const AIM_OPACITY = 0.42;
const AIM_SPACING = 1.6; // 점 사이 거리
const AIM_DOT = 0.42; // 점 크기
const AIM_MAX_DOTS = 48;

export function createMarks(scene, { pitchDeg = 58 } = {}) {
  const { block, material } = getBlockAssets();
  const tilt = -THREE.MathUtils.degToRad(pitchDeg) * 0.75; // 카메라 쪽으로 살짝 눕혀서 '!' 가 잘 보이게

  // ── '!' ──
  const perAlert = ALERT_SHAPE.length;
  const alertMesh = new THREE.InstancedMesh(block, material, ALERT_COUNT * perAlert);
  alertMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  alertMesh.frustumCulled = false;
  alertMesh.castShadow = false;
  alertMesh.count = 0;
  alertMesh.name = 'fxAlert';
  const red = new THREE.Color(ALERT_HEX);
  const shine = new THREE.Color(ALERT_SHINE_HEX);
  for (let i = 0; i < ALERT_COUNT * perAlert; i++) alertMesh.setColorAt(i, i % perAlert === perAlert - 1 ? shine : red);
  alertMesh.instanceColor.needsUpdate = true;
  scene.add(alertMesh);

  const alerts = [];
  for (let i = 0; i < ALERT_COUNT; i++) alerts.push({ active: false, follow: null, age: 0, life: 1, lift: ALERT_LIFT, seed: i * 1.7 });

  const matrix = new THREE.Matrix4();
  const groupMatrix = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const anchor = new THREE.Vector3();

  function alert(followFn, seconds = 1, lift = ALERT_LIFT) {
    let item = alerts.find((a) => !a.active);
    if (!item) item = alerts.reduce((a, b) => (a.age > b.age ? a : b));
    item.active = true;
    item.follow = followFn;
    item.age = 0;
    item.life = Math.max(ALERT_POP + ALERT_HIDE, seconds);
    item.lift = lift;
  }

  function updateAlerts(dt) {
    let n = 0;
    for (let a = 0; a < alerts.length; a++) {
      const item = alerts[a];
      if (!item.active) continue;
      item.age += dt;
      if (item.age >= item.life) {
        item.active = false;
        item.follow = null;
        continue;
      }
      const at = item.follow ? item.follow() : null;
      if (!at) continue;
      anchor.copy(at);
      if (anchor.y < 1) anchor.y += item.lift;
      const t = item.age;
      // 뿅! 크게 튀어나왔다가 제 크기로, 끝날 때 쏙 작아짐
      let s;
      if (t < ALERT_POP) {
        const p = t / ALERT_POP;
        s = p < 0.6 ? (p / 0.6) * 1.4 : 1.4 - 0.4 * ((p - 0.6) / 0.4);
      } else s = 1;
      const left = item.life - t;
      if (left < ALERT_HIDE) s *= left / ALERT_HIDE;
      const bob = Math.sin(t * 9 + item.seed) * 0.35 + Math.max(0, 1 - t / ALERT_POP) * 1.5;
      const wobble = Math.sin(t * 13 + item.seed) * 0.18 * Math.max(0.3, 1 - t * 1.5);
      position.set(anchor.x, anchor.y + bob, anchor.z);
      quaternion.setFromEuler(euler.set(tilt, 0, wobble));
      scale.setScalar(Math.max(0.001, s) * ALERT_BLOCK);
      groupMatrix.compose(position, quaternion, scale);
      for (let k = 0; k < perAlert; k++) {
        local.makeTranslation(0, ALERT_SHAPE[k] + 0.5, 0);
        matrix.multiplyMatrices(groupMatrix, local);
        alertMesh.setMatrixAt(n * perAlert + k, matrix);
      }
      n++;
    }
    alertMesh.count = n * perAlert;
    alertMesh.visible = n > 0;
    if (n > 0) alertMesh.instanceMatrix.needsUpdate = true;
  }

  // ── 조준 점선 ──
  const dotGeometry = new THREE.BoxGeometry(1, 0.2, 1);
  const dotMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(AIM_HEX), transparent: true, opacity: AIM_OPACITY, depthWrite: false });
  const dots = new THREE.InstancedMesh(dotGeometry, dotMaterial, AIM_MAX_DOTS);
  dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  dots.frustumCulled = false;
  dots.count = 0;
  dots.visible = false;
  dots.renderOrder = 3;
  dots.name = 'fxAimLine';
  scene.add(dots);
  let march = 0;

  function aimLine(from, to, visible = true) {
    if (!visible || !from || !to) {
      dots.visible = false;
      return;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dy, dz);
    if (length < 0.5) {
      dots.visible = false;
      return;
    }
    const yaw = Math.atan2(dx, dz);
    let n = 0;
    for (let d = AIM_SPACING * 0.6 + (march % AIM_SPACING); d < length && n < AIM_MAX_DOTS; d += AIM_SPACING) {
      const f = d / length;
      const fade = Math.min(1, (length - d) / 3); // 끝으로 갈수록 작게
      position.set(from.x + dx * f, from.y + dy * f, from.z + dz * f);
      quaternion.setFromEuler(euler.set(0, yaw + Math.PI / 4, 0));
      scale.set(AIM_DOT * fade, 1, AIM_DOT * fade);
      matrix.compose(position, quaternion, scale);
      dots.setMatrixAt(n++, matrix);
    }
    dots.count = n;
    dots.visible = n > 0;
    dots.instanceMatrix.needsUpdate = true;
  }

  function update(dt) {
    updateAlerts(dt);
    march += dt * 5;
  }

  function clear() {
    for (const item of alerts) {
      item.active = false;
      item.follow = null;
    }
    alertMesh.count = 0;
    alertMesh.visible = false;
    dots.visible = false;
  }

  return { alert, aimLine, update, clear };
}
