// 레이저 눈의 빛 (눈앞에 모이는 빛 덩어리, 흐릿한 조준선, 네모난 빛줄기)
// 장난감 블록 느낌이 나게 빛줄기도 네모 기둥입니다: 가운데 하얀 심 + 바깥 빨간 빛 (더하기 섞기로 환하게).
// laserEyeAttack.js 가 만들어 쓰고, 공격이 끝나거나 괴수가 터지면 dispose() 로 장면에서 뺍니다.
// 모양(상자·공)과 재질은 모든 레이저가 함께 써서 몇 번을 쏴도 새로 만들지 않습니다.
//
//   const beam = createLaserBeam(scene)
//   beam.glow(위치, 크기 0~)          눈앞 빛 덩어리 (0 이면 숨김)
//   beam.aim(from, to, 세기 0~1)      힘 모을 때 흐릿하게 깜빡이는 조준선 (0 이면 숨김)
//   beam.fire(points, 세기 0~1)       빛줄기: points = [눈, 꺾이는 점, 끝] 세 점 (0 이면 숨김)
//   beam.dispose()
//
// 색·굵기는 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';

const CORE_HEX = '#FFF6C8'; // 빛줄기 가운데 (거의 흰 노랑)
const GLOW_HEX = '#FF2A12'; // 빛줄기 바깥 (빨강)
const AIM_HEX = '#FF4A2A'; // 조준선
const ORB_HEX = '#FFD23A'; // 눈앞 빛 덩어리
const CORE_WIDTH = 0.5; // 가운데 심 굵기 (칸)
const GLOW_WIDTH = 1.5; // 바깥 빛 굵기 (칸)
const AIM_WIDTH = 0.16; // 조준선 굵기

let shared = null;
function assets() {
  if (shared) return shared;
  const additive = (hex, opacity) =>
    new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  shared = {
    box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5), // 길이 방향 = +z, 한쪽 끝이 원점
    orb: new THREE.IcosahedronGeometry(1, 1),
    core: new THREE.MeshBasicMaterial({ color: new THREE.Color(CORE_HEX), toneMapped: false }),
    glow: additive(GLOW_HEX, 0.55),
    aim: additive(AIM_HEX, 0.5),
    orbInner: new THREE.MeshBasicMaterial({ color: new THREE.Color(CORE_HEX), toneMapped: false }),
    orbOuter: additive(ORB_HEX, 0.5),
  };
  return shared;
}

export function createLaserBeam(scene) {
  const a = assets();
  const group = new THREE.Group();
  group.name = 'laserBeam';
  const make = (geometry, material, order) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    group.add(mesh);
    return mesh;
  };
  // 빛줄기는 두 토막 (눈 → 꺾이는 점 → 끝): 토막마다 심 + 빛
  const cores = [make(a.box, a.core, 6), make(a.box, a.core, 6)];
  const glows = [make(a.box, a.glow, 7), make(a.box, a.glow, 7)];
  const aimLine = make(a.box, a.aim, 7);
  const orbIn = make(a.orb, a.orbInner, 6);
  const orbOut = make(a.orb, a.orbOuter, 7);
  scene?.add(group);

  function stretch(mesh, from, to, width) {
    const length = from.distanceTo(to);
    if (length < 1e-3) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.position.copy(from);
    mesh.lookAt(to);
    mesh.scale.set(width, width, length);
  }

  return {
    glow(at, size) {
      const on = size > 0.01;
      orbIn.visible = orbOut.visible = on;
      if (!on) return;
      orbIn.position.copy(at);
      orbOut.position.copy(at);
      orbIn.scale.setScalar(size * 0.45);
      orbOut.scale.setScalar(size);
    },
    aim(from, to, strength) {
      if (!(strength > 0.01)) {
        aimLine.visible = false;
        return;
      }
      stretch(aimLine, from, to, AIM_WIDTH * (0.6 + strength));
    },
    fire(points, strength) {
      const on = strength > 0.01 && points && points.length >= 2;
      for (let i = 0; i < 2; i++) {
        const from = points?.[i];
        const to = points?.[i + 1];
        if (!on || !from || !to) {
          cores[i].visible = glows[i].visible = false;
          continue;
        }
        stretch(cores[i], from, to, CORE_WIDTH * strength);
        stretch(glows[i], from, to, GLOW_WIDTH * (0.75 + 0.25 * strength));
      }
    },
    dispose() {
      group.removeFromParent(); // 모양·재질은 다른 레이저와 함께 쓰므로 지우지 않음
    },
  };
}
