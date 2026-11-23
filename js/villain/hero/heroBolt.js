// 번개 줄기 (영웅이 하늘에서 내려올 때 번쩍)
// 지그재그 막대 몇 개를 하늘에서 땅까지 이어 붙여 잠깐 번쩍이고 사라집니다. 빛을 받지 않는 밝은 색이라 눈에 확 띕니다.
//
//   const bolt = createBolt(scene, { core, glow, width }?)   색을 주면 그 색 빛줄기 (얼음 마법사 = 하늘색, 황금 수호자 = 금색)
//   bolt.strike(position, seconds = 0.35)   그 자리에 번개
//   bolt.update(dt) ; bolt.dispose()

import * as THREE from '../../lib/three.js';

const HEIGHT = 46; // 번개 길이 (칸)
const PIECES = 7; // 꺾이는 마디 수
const WIDTH = 0.9; // 굵기
const CORE_HEX = '#FFF03A'; // 연노랑
const GLOW_HEX = '#F4F4F4';

export function createBolt(scene, { core: coreHex = CORE_HEX, glow: glowHex = GLOW_HEX, width = WIDTH } = {}) {
  const group = new THREE.Group();
  group.name = 'heroBolt';
  group.visible = false;
  scene.add(group);
  const core = new THREE.MeshBasicMaterial({ color: coreHex, transparent: true, opacity: 1, depthWrite: false });
  const glow = new THREE.MeshBasicMaterial({ color: glowHex, transparent: true, opacity: 1, depthWrite: false });
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const pieces = [];
  for (let i = 0; i < PIECES; i++) {
    const outer = new THREE.Mesh(geometry, core);
    const inner = new THREE.Mesh(geometry, glow);
    outer.renderOrder = 5;
    inner.renderOrder = 6;
    group.add(outer, inner);
    pieces.push([outer, inner]);
  }
  let time = 0;
  let duration = 0;

  // 마디를 새로 꺾음 (번쩍일 때마다 모양이 조금 달라짐)
  function shape() {
    const step = HEIGHT / PIECES;
    let x = 0;
    for (let i = 0; i < PIECES; i++) {
      const nextX = i === PIECES - 1 ? (Math.random() - 0.5) * 6 : (i % 2 ? 1 : -1) * (1.2 + Math.random() * 1.8);
      const dx = nextX - x;
      const length = Math.hypot(dx, step);
      const angle = Math.atan2(dx, step);
      for (const [k, mesh] of pieces[i].entries()) {
        const w = k === 0 ? width : width * 0.4;
        mesh.position.set((x + nextX) / 2, i * step + step / 2, k * 0.05);
        mesh.rotation.z = -angle;
        mesh.scale.set(w, length + w * 0.5, k === 0 ? 0.2 : 0.25);
      }
      x = nextX;
    }
  }

  return {
    strike(position, seconds = 0.35) {
      group.position.set(position.x, 0, position.z);
      group.visible = true;
      time = 0;
      duration = seconds;
      shape();
    },
    update(dt) {
      if (!group.visible) return;
      const before = Math.floor(time / 0.07);
      time += dt;
      if (time >= duration) {
        group.visible = false;
        return;
      }
      if (Math.floor(time / 0.07) !== before) shape(); // 지지직 떨림
      const fade = 1 - time / duration;
      core.opacity = Math.min(1, fade * 1.6);
      glow.opacity = Math.min(1, fade * 2);
    },
    dispose() {
      group.removeFromParent();
      geometry.dispose();
      core.dispose();
      glow.dispose();
    },
  };
}
