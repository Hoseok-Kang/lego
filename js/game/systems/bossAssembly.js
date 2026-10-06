// 대장 등장
// 대장 몬스터가 나올 때, 전장 바닥에 남아 있던 잔해 블록(쓰러진 몬스터·부서진 성에서 떨어진 블록)이
// 들썩이며 떠올라 한곳으로 쭉 모여서 대장의 몸이 됩니다. 잔해가 모자라면 나머지는 하늘에서 떨어집니다.
// 시간·높이 숫자는 gameConfig.js 의 bossAssembly 에서 바꿉니다.
//
//   assembly.start(enemy)    대장이 나타날 때 부름 (enemy.assembling = true 동안 대장은 움직이지 않고 맞지도 않음)
//   assembly.update(dt)
//   assembly.isBusy          모이는 중인 대장이 있는지
//   assembly.clear()         다시 하기
//
// 소식: 'bossAssembling' { enemy, fromRubble, total }  /  'bossAssembled' { enemy }

import * as THREE from '../../lib/three.js';
import { createBlockBatch } from '../core/blockAssets.js';

const CAPACITY = 2000; // 한꺼번에 날아갈 수 있는 블록 수 (대장 두 마리 분량)

export function createBossAssembly({ scene, events, debris, config }) {
  const cfg = config.bossAssembly;
  const batch = createBlockBatch(CAPACITY);
  scene.add(batch.bodies);
  const runs = [];

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const target = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const identity = new THREE.Quaternion();
  const spinRotation = new THREE.Quaternion();
  const unit = new THREE.Vector3(1, 1, 1);
  const color = new THREE.Color();

  function start(enemy) {
    const figure = enemy.figure;
    if (!figure) return;
    figure.finishBuild();
    figure.group.visible = false;
    enemy.assembling = true;
    figure.group.updateWorldMatrix(true, false);

    const blueprint = figure.blueprint;
    const slots = [];
    for (let slot = 0; slot < figure.aliveCount; slot++) slots.push(figure.slotBlock[slot]);
    const rubble = debris.takeRubble(slots.length);
    const rows = Math.max(1, blueprint.rows);

    const items = slots.map((blockIndex, k) => {
      const local = new THREE.Vector3(
        blueprint.positions[blockIndex * 3],
        blueprint.positions[blockIndex * 3 + 1],
        blueprint.positions[blockIndex * 3 + 2],
      );
      target.copy(local).applyMatrix4(figure.group.matrixWorld);
      const source = rubble[k];
      const from = source
        ? source.position.clone()
        : target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 12, cfg.skyHeight, (Math.random() - 0.5) * 12));
      // 아래쪽 블록부터 출발해서 대장이 발부터 쌓여 올라감
      const height = blueprint.cells[blockIndex * 3 + 1] / rows;
      return {
        local,
        from,
        fromQuaternion: source ? source.quaternion : identity.clone(),
        fromColor: source ? source.color : blueprint.colors[blockIndex].clone(),
        toColor: blueprint.colors[blockIndex],
        start: cfg.gatherSeconds + height * cfg.spreadSeconds + Math.random() * 0.25,
        spinAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        swirl: (Math.random() - 0.5) * 8,
        phase: Math.random() * Math.PI * 2,
        landed: false,
        fromSky: !source,
      };
    });
    runs.push({ enemy, figure, items, time: 0, left: items.length });
    events.emit('bossAssembling', { enemy, fromRubble: rubble.length, total: items.length });
  }

  function update(dt) {
    let slot = 0;
    for (let r = runs.length - 1; r >= 0; r--) {
      const run = runs[r];
      if (!run.enemy.alive || run.figure !== run.enemy.figure) {
        runs.splice(r, 1); // 그사이 다시 하기 등으로 사라졌으면 그만둠
        continue;
      }
      run.time += dt;
      run.figure.group.updateWorldMatrix(true, false);
      for (const item of run.items) {
        const local = run.time - item.start;
        if (!item.landed && local >= cfg.flySeconds) {
          item.landed = true;
          run.left--;
          events.emit('blockLanded');
        }
        if (slot >= CAPACITY) continue;
        target.copy(item.local).applyMatrix4(run.figure.group.matrixWorld);
        if (item.landed) {
          // 도착한 블록은 제자리에 그대로 보임 → 대장이 발부터 차곡차곡 쌓여 가는 모습
          position.copy(target);
          rotation.copy(identity);
          color.copy(item.toColor);
        } else if (local < 0) {
          // 모이기 전: 바닥 잔해가 들썩들썩 (하늘에서 올 블록은 아직 안 보임)
          if (item.fromSky) continue;
          const shake = Math.min(1, run.time / cfg.gatherSeconds);
          position.copy(item.from);
          position.y += Math.abs(Math.sin(run.time * 14 + item.phase)) * 0.35 * shake;
          rotation.copy(item.fromQuaternion);
          color.copy(item.fromColor);
        } else {
          const t = local / cfg.flySeconds;
          const e = t * t * (3 - 2 * t); // 천천히 출발해서 천천히 도착
          // 위로 솟았다가 내려오는 곡선 + 옆으로 살짝 휘감기
          const lift = item.fromSky ? 0 : cfg.lift * Math.sin(Math.PI * Math.min(1, t * 1.1));
          position.lerpVectors(item.from, target, e);
          position.y += lift;
          position.x += Math.sin(Math.PI * t) * item.swirl * 0.5;
          position.z += Math.sin(Math.PI * t) * item.swirl * 0.5;
          spinRotation.setFromAxisAngle(item.spinAxis, (1 - e) * 6);
          rotation.slerpQuaternions(item.fromQuaternion, identity, e).multiply(spinRotation);
          color.copy(item.fromColor).lerp(item.toColor, Math.min(1, Math.max(0, (t - 0.4) / 0.6)));
        }
        matrix.compose(position, rotation, unit);
        batch.bodies.setMatrixAt(slot, matrix);
        batch.bodies.setColorAt(slot, color);
        slot++;
      }
      if (run.left === 0) {
        runs.splice(r, 1);
        run.figure.group.visible = true;
        run.enemy.assembling = false;
        events.emit('bossAssembled', { enemy: run.enemy });
      }
    }
    const mesh = batch.bodies;
    if (slot === 0 && mesh.count === 0) return;
    mesh.count = slot;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function clear() {
    runs.length = 0;
    batch.bodies.count = 0;
  }

  return {
    start,
    update,
    clear,
    get isBusy() {
      return runs.length > 0;
    },
  };
}
