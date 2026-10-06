// 블록 인형 (BlockFigure)
// 설계도(blueprints.js) 하나로 3D 블록 덩어리 하나를 만듭니다. 성, 타워, 몬스터가 모두 이것으로 만들어집니다.
//
// 할 수 있는 일
//   figure.group                  위치·회전·크기를 바꾸면 블록 전체가 함께 움직임
//   figure.build(초, 옵션)         블록이 위에서 떨어져 쌓이며 만들어지는 모션 시작
//   figure.update(dt)              매 장면마다 불러서 모션 진행
//   figure.isBuilt                 다 쌓였는지
//   figure.removeBlocks(n, 방식)   블록 n개를 떼어 내고, 떼어 낸 블록의 [{ position, color }] 를 돌려줌
//                                  방식: 'random'(아무 데나) | 'exposed'(위가 비어 있는 블록) | 'top'(가장 높은 블록)
//   figure.removeAll()             남은 블록 전부 떼어 내기 (쓰러질 때)
//   figure.restoreBlocks(n, 옵션)   떨어져 나갔던 블록 n개를 아래쪽부터 다시 떨어뜨려 쌓기 (수리)
//   figure.setTint(색|null, 정도)   몸 전체 색을 살짝 물들이기 (얼었을 때 등)
//   figure.dispose()               화면에서 지우기

import * as THREE from '../../lib/three.js';
import { CONFIG } from '../../config.js';
import { createStackAnimator } from '../../motion/stackAnimator.js';
import { createBlockBatch } from './blockAssets.js';

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const euler = new THREE.Euler();
const scale = new THREE.Vector3();
const tmpColor = new THREE.Color();
const RESTORE_FALL_SECONDS = 0.35; // 수리할 때 블록 하나가 떨어지는 시간

export class BlockFigure {
  constructor(blueprint, parent, { castShadow = true } = {}) {
    this.blueprint = blueprint;
    this.group = new THREE.Group();
    parent.add(this.group);

    const batch = createBlockBatch(blueprint.count, { castShadow });
    this.bodies = batch.bodies;
    this.studs = batch.studs;
    this.group.add(this.bodies, this.studs);

    this.alive = blueprint.count; // 남아 있는 블록 수
    this.slotBlock = new Int32Array(blueprint.count); // 그리는 칸 → 설계도 블록 번호
    this.occupied = new Set(); // 남아 있는 블록의 격자 칸
    this.tint = null;
    this.tintColor = null;
    this.tintAmount = 0;
    this.restoring = null;
    for (let i = 0; i < blueprint.count; i++) {
      this.slotBlock[i] = i;
      this.occupied.add(cellKey(blueprint.cells, i));
      this.bodies.setColorAt(i, blueprint.colors[i]);
      this.studs.setColorAt(i, blueprint.colors[i]);
      this.setFinal(i);
    }
    this.setVisibleCount(blueprint.count);
    this.commit();
    this.bodies.instanceColor.needsUpdate = true;
    this.studs.instanceColor.needsUpdate = true;

    this.animator = null;
    this.isBuilt = true;
  }

  get height() {
    return this.blueprint.rows;
  }

  get width() {
    return this.blueprint.columns;
  }

  get aliveCount() {
    return this.alive;
  }

  // 블록이 하나씩 위에서 떨어져 쌓이는 모션 시작
  build(seconds, { dropHeight = CONFIG.motion.dropHeight, onLand, onComplete } = {}) {
    const count = this.blueprint.count;
    const motion = {
      ...CONFIG.motion,
      speed: 1,
      dropHeight,
      secondsPerBlock: seconds / Math.max(1, count),
      minBuildSeconds: seconds,
      maxBuildSeconds: seconds,
    };
    this.isBuilt = false;
    this.animator = createStackAnimator(this, motion, {
      onLand,
      onComplete: () => {
        this.isBuilt = true;
        this.animator = null;
        onComplete?.();
      },
    });
    this.animator.start({ blocks: { length: count } });
  }

  finishBuild() {
    if (this.animator) this.animator.finish();
  }

  // 쌓기 진행도 (0~1)
  get buildProgress() {
    return this.animator ? this.animator.progress() : 1;
  }

  update(dt) {
    if (this.animator) this.animator.update(dt);
    if (this.restoring) this.updateRestore(dt);
  }

  removeBlocks(n, mode = 'random') {
    if (this.animator) this.finishBuild();
    this.finishRestore();
    const removed = [];
    if (n <= 0 || this.alive === 0) return removed;
    this.group.updateWorldMatrix(true, false);
    for (let k = 0; k < n && this.alive > 0; k++) removed.push(this.detach(this.pickSlot(mode)));
    this.afterRemove();
    return removed;
  }

  removeAll() {
    return this.removeBlocks(this.alive, 'random');
  }

  setTint(hex, amount = 0.5) {
    const key = hex ? `${hex}|${amount}` : null;
    if (key === this.tint) return;
    this.tint = key;
    this.tintColor = hex ? new THREE.Color(hex) : null;
    this.tintAmount = amount;
    for (let slot = 0; slot < this.alive; slot++) this.paintSlot(slot);
    this.bodies.instanceColor.needsUpdate = true;
    this.studs.instanceColor.needsUpdate = true;
  }

  // 떨어져 나갔던 블록을 아래쪽부터 n개 골라 위에서 하나씩 떨어뜨려 제자리에 다시 쌓음
  restoreBlocks(n, { seconds = 1.2, dropHeight = 6, onLand } = {}) {
    if (this.animator) this.finishBuild();
    this.finishRestore();
    const cells = this.blueprint.cells;
    const missing = [];
    for (let i = 0; i < this.blueprint.count; i++) {
      if (!this.occupied.has(cellKey(cells, i))) missing.push({ index: i, y: cells[i * 3 + 1], shuffle: Math.random() });
    }
    missing.sort((a, b) => a.y - b.y || a.shuffle - b.shuffle);
    const picked = missing.slice(0, Math.max(0, Math.floor(n)));
    if (picked.length === 0) return 0;

    const interval = picked.length > 1 ? Math.max(0, seconds - RESTORE_FALL_SECONDS) / (picked.length - 1) : 0;
    const items = picked.map(({ index }, k) => {
      const slot = this.alive++;
      this.slotBlock[slot] = index;
      this.occupied.add(cellKey(cells, index));
      this.paintSlot(slot);
      this.setPose(slot, 0, dropHeight, 0, 0, 0.001, 0.001, 0.001);
      return { slot, start: k * interval, landed: false };
    });
    this.restoring = { time: 0, dropHeight, onLand, items, left: items.length };
    this.setVisibleCount(this.alive);
    this.commit();
    this.bodies.instanceColor.needsUpdate = true;
    this.studs.instanceColor.needsUpdate = true;
    return picked.length;
  }

  finishRestore() {
    if (!this.restoring) return;
    for (const item of this.restoring.items) if (!item.landed) this.setFinal(item.slot);
    this.restoring = null;
    this.commit();
  }

  dispose() {
    this.group.removeFromParent();
    this.bodies.dispose();
    this.studs.dispose();
  }

  // ── 아래는 내부에서 쓰는 기능 ──

  // stackAnimator 가 쓰는 연결 기능 (블록 이미지 빌더와 같은 모션을 그대로 씀)
  get blockSize() {
    return 1;
  }

  setVisibleCount(n) {
    this.bodies.count = n;
    this.studs.count = n;
  }

  setPose(slot, dx, dy, dz, tilt, scaleX, scaleY, scaleZ) {
    const p = this.blueprint.positions;
    const b = this.slotBlock[slot] * 3;
    position.set(p[b] + dx, p[b + 1] + dy, p[b + 2] + dz);
    rotation.setFromEuler(euler.set(0, 0, tilt));
    scale.set(scaleX, scaleY, scaleZ);
    matrix.compose(position, rotation, scale);
    this.bodies.setMatrixAt(slot, matrix);
    this.studs.setMatrixAt(slot, matrix);
  }

  setFinal(slot) {
    this.setPose(slot, 0, 0, 0, 0, 1, 1, 1);
  }

  commit() {
    this.bodies.instanceMatrix.needsUpdate = true;
    this.studs.instanceMatrix.needsUpdate = true;
  }

  paintSlot(slot) {
    tmpColor.copy(this.blueprint.colors[this.slotBlock[slot]]);
    if (this.tintColor) tmpColor.lerp(this.tintColor, this.tintAmount);
    this.bodies.setColorAt(slot, tmpColor);
    this.studs.setColorAt(slot, tmpColor);
  }

  updateRestore(dt) {
    const restore = this.restoring;
    restore.time += dt;
    for (const item of restore.items) {
      if (item.landed) continue;
      const local = restore.time - item.start;
      if (local < 0) continue;
      if (local >= RESTORE_FALL_SECONDS) {
        this.setFinal(item.slot);
        item.landed = true;
        restore.left--;
        restore.onLand?.();
        continue;
      }
      const p = local / RESTORE_FALL_SECONDS;
      const grow = Math.min(1, p * 4);
      this.setPose(item.slot, 0, restore.dropHeight * (1 - p * p), 0, 0, grow, grow, grow);
    }
    this.commit();
    if (restore.left === 0) this.restoring = null;
  }

  pickSlot(mode) {
    const cells = this.blueprint.cells;
    if (mode === 'top') {
      let best = 0;
      let bestY = -Infinity;
      for (let slot = 0; slot < this.alive; slot++) {
        const y = cells[this.slotBlock[slot] * 3 + 1] + Math.random() * 0.5;
        if (y > bestY) {
          bestY = y;
          best = slot;
        }
      }
      return best;
    }
    if (mode === 'exposed') {
      for (let tries = 0; tries < 16; tries++) {
        const slot = Math.floor(Math.random() * this.alive);
        const b = this.slotBlock[slot] * 3;
        if (!this.occupied.has(packCell(cells[b], cells[b + 1] + 1, cells[b + 2]))) return slot;
      }
    }
    return Math.floor(Math.random() * this.alive);
  }

  // 칸 하나를 떼어 내고, 맨 끝 칸을 그 자리로 옮겨 빈칸이 없게 함
  detach(slot) {
    const blockIndex = this.slotBlock[slot];
    const p = this.blueprint.positions;
    const world = new THREE.Vector3(p[blockIndex * 3], p[blockIndex * 3 + 1], p[blockIndex * 3 + 2]).applyMatrix4(
      this.group.matrixWorld,
    );
    const color = this.blueprint.colors[blockIndex];
    this.occupied.delete(cellKey(this.blueprint.cells, blockIndex));

    const last = this.alive - 1;
    if (slot !== last) {
      for (const mesh of [this.bodies, this.studs]) {
        mesh.getMatrixAt(last, matrix);
        mesh.setMatrixAt(slot, matrix);
        mesh.getColorAt(last, tmpColor);
        mesh.setColorAt(slot, tmpColor);
      }
      this.slotBlock[slot] = this.slotBlock[last];
    }
    this.alive = last;
    return { position: world, color };
  }

  afterRemove() {
    this.setVisibleCount(this.alive);
    this.commit();
    this.bodies.instanceColor.needsUpdate = true;
    this.studs.instanceColor.needsUpdate = true;
  }
}

function packCell(x, y, z) {
  return x + 1024 * (y + 1024 * z);
}

function cellKey(cells, blockIndex) {
  return packCell(cells[blockIndex * 3], cells[blockIndex * 3 + 1], cells[blockIndex * 3 + 2]);
}
