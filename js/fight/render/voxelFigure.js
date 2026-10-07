// 블록 인형 (토끼 한 마리 = 블록 묶음 하나)
// 토끼 설계도(rabbitArt.js 의 ModelDef)를 받아 블록 인형을 만듭니다.
// 몸·머리·귀·팔·발 같은 '부위'마다 움직이는 손잡이(pivot 노드)가 있어서,
// 손잡이를 돌리거나 옮긴 뒤 update() 를 부르면 그 부위 블록이 함께 움직입니다.
// 블록은 전부 한 번에 그려서(InstancedMesh 하나) 휴대폰에서도 가볍습니다.
//
//   const fig = createVoxelFigure(scene, modelDef, { castShadow = true, scale = 1, parents })
//     parents: { 부위: 부모 부위 } (예: { earL: 'head' }) — 없으면 모든 부위가 root 바로 아래
//   fig.root                         장면에 놓인 뿌리. 위치(position)·방향(rotation.y)을 여기서 정함
//   fig.parts[이름]                   부위 손잡이 (돌리거나 옮기면 그 부위가 움직임)
//   fig.pivots[이름]                  부위 손잡이의 모델 좌표 [x, y, z]
//   fig.addPart(이름, voxels, { parent, pivot, at })   무기 같은 부위 더하기 → 손잡이 노드
//                                    pivot: voxels 안에서 손잡이가 될 점 (무기의 grip)
//                                    at: 그 점이 놓일 자리 (모델 좌표, 예: 손 위치)
//   fig.removePart(이름)              더한 부위 빼기 (무기 바꾸기)
//   fig.update()                     손잡이 자세대로 블록 위치 다시 계산 (매 장면 자세를 정한 뒤 한 번)
//   fig.popBlocks(n) → [{ position, color }]   귀 끝부터 n개 떼어 냄 (세상 좌표, 부서진 조각용)
//                                    귀를 다 떼었으면 몸통·무기가 아닌 블록을 아무거나
//   fig.restoreBlocks(n) → 다시 붙인 수        마지막에 떼어 낸 블록부터 위에서 톡 떨어져 다시 붙음
//   fig.explode() → [{ position, color }]      보이는 블록 전부 (무기 포함) 떼어 냄 ('펑!')
//   fig.reset()                      모든 블록을 다시 보이게 (다시 하기)
//   fig.animate(dt)                  다시 붙는 블록 모션 진행
//   fig.setFlash(정도 0~1, 색='#FFFFFF')   몸 전체를 잠깐 물들이기 (바뀔 때만 색을 다시 보냄)
//   fig.setVisible(참/거짓) ; fig.dispose()
//   fig.totalCount / fig.visibleCount / fig.popTotal / fig.popRemaining / fig.exploded / fig.mesh
//
// 숨긴 블록은 크기 0 으로 만들어 번호가 바뀌지 않게 합니다. (블록 숫자 계산은 figureBlocks.js)

import * as THREE from '../../lib/three.js';
import { createBlockBatch } from '../../game/core/blockAssets.js';
import { createBlockStore, writeMatrices, writeColors, blockWorldPosition, createRestoreQueue, markUpload } from './figureBlocks.js';

const SPARE_BLOCKS = 72; // 무기 블록을 위해 미리 비워 두는 칸 수 (모자라면 자동으로 늘림)
const RESTORE_GAP = 0.07; // 다시 붙는 블록 하나하나가 출발하는 간격 (초)
const FLASH_BOOST = 1.7; // 반짝일 때 원래 색보다 더 밝게 (하얀 토끼도 반짝이는 게 보이게)
const FLASH_STEPS = 40; // 반짝임 정도를 이 단계로 끊어서 색을 덜 자주 보냄
const KIND_PART = 0;
const KIND_BODY = 1;
const KIND_EXTRA = 2;

const tmpColor = new THREE.Color();

export function createVoxelFigure(scene, modelDef, { castShadow = true, scale = 1, parents = null } = {}) {
  const root = new THREE.Group();
  root.name = 'voxelFigure';
  root.scale.setScalar(scale);
  scene.add(root);

  // ── 부위 손잡이 만들기 ──
  const parts = {};
  const pivots = {}; // 부위 이름 → 모델 좌표의 손잡이 위치
  const nodes = []; // 블록이 붙는 손잡이 목록 (번호로 찾음)
  const partNames = Object.keys(modelDef.parts);
  for (const name of partNames) {
    parts[name] = new THREE.Group();
    parts[name].name = name;
    pivots[name] = modelDef.parts[name].pivot || [0, 0, 0];
  }
  for (const name of partNames) {
    const parentName = parents?.[name];
    const parentNode = parentName && parts[parentName] && parentName !== name ? parts[parentName] : root;
    attach(parts[name], parentNode, parentNode === root ? null : pivots[parentName], pivots[name]);
  }

  // ── 블록 정보 (번호 = 그리는 칸) ──
  let baseCount = 0;
  for (const name of partNames) baseCount += modelDef.parts[name].voxels.length;
  let total = 0;
  let capacity = 0;
  let store = null;
  let batch = null;
  const extras = []; // 더한 부위 [{ name, node, start, count }]
  let exploded = false;
  let visible = true;
  let needsWrite = true; // 다 터진 뒤에는 한 번만 그리고 쉼
  const flashColor = new THREE.Color(FLASH_BOOST, FLASH_BOOST, FLASH_BOOST);
  let flashAmount = 0;
  let flashHex = '#FFFFFF';
  let colorsDirty = true;
  const matrixRange = { start: 0, count: 0 };
  const colorRange = { start: 0, count: 0 };
  allocate(baseCount + SPARE_BLOCKS);

  const partStart = {};
  for (const name of partNames) {
    partStart[name] = total;
    const nodeIndex = nodes.push(parts[name]) - 1;
    const kind = name === 'body' ? KIND_BODY : KIND_PART;
    for (const voxel of modelDef.parts[name].voxels) writeBlock(total++, nodeIndex, voxel, pivots[name], kind);
  }

  // 귀 블록이 떨어지는 순서 → 블록 번호
  const popOrder = (modelDef.popOrder || [])
    .map(({ part, index }) => (partStart[part] !== undefined && index < modelDef.parts[part].voxels.length ? partStart[part] + index : -1))
    .filter((i) => i >= 0);
  const popTotal = popOrder.length;
  const poppedStack = new Int32Array(Math.max(1, baseCount)); // 떼어 낸 순서 (다시 붙일 때 거꾸로)
  let poppedCount = 0;
  const restoring = createRestoreQueue(baseCount);

  // ── 내부 ──
  function attach(node, parentNode, parentPivot, at) {
    const base = parentPivot || [0, 0, 0];
    node.position.set(at[0] - base[0], at[1] - base[1], at[2] - base[2]);
    parentNode.add(node);
  }

  function allocate(size) {
    const oldBatch = batch;
    capacity = size;
    store = createBlockStore(size, store);
    batch = createBlockBatch(size, { castShadow, receiveShadow: true });
    batch.bodies.name = 'voxelFigureBlocks';
    batch.bodies.count = total;
    batch.bodies.visible = visible;
    scene.add(batch.bodies);
    if (oldBatch) {
      scene.remove(oldBatch.bodies);
      oldBatch.bodies.dispose();
    }
    colorsDirty = true;
    needsWrite = true;
  }

  function writeBlock(i, nodeIndex, voxel, pivot, kind) {
    store.offset[i * 3] = voxel.x - pivot[0];
    store.offset[i * 3 + 1] = voxel.y - pivot[1];
    store.offset[i * 3 + 2] = voxel.z - pivot[2];
    store.node[i] = nodeIndex;
    tmpColor.set(voxel.hex);
    store.color[i * 3] = tmpColor.r;
    store.color[i * 3 + 1] = tmpColor.g;
    store.color[i * 3 + 2] = tmpColor.b;
    store.hidden[i] = exploded ? 1 : 0;
    store.dropY[i] = 0;
    store.grow[i] = 1;
    store.kind[i] = kind;
  }

  // 블록 하나를 떼어 내고 그 자리의 세상 위치·색을 목록에 담음
  function takeBlock(i, list) {
    restoring.remove(i);
    store.hidden[i] = 1;
    store.dropY[i] = 0;
    store.grow[i] = 1;
    list.push({
      position: blockWorldPosition(store, nodes, i, new THREE.Vector3()),
      color: new THREE.Color(store.color[i * 3], store.color[i * 3 + 1], store.color[i * 3 + 2]),
    });
  }

  // 귀를 다 떼었으면: 몸통·무기가 아닌 보이는 블록 하나를 아무거나
  function randomSpareBlock() {
    let seen = 0;
    let pick = -1;
    for (let i = 0; i < baseCount; i++) {
      if (store.hidden[i] || store.kind[i] !== KIND_PART) continue;
      seen++;
      if (Math.random() * seen < 1) pick = i;
    }
    return pick;
  }

  function flushColors() {
    const mesh = batch.bodies;
    writeColors(mesh.instanceColor.array, store, total, flashColor, flashAmount);
    markUpload(mesh.instanceColor, colorRange, total * 3);
    colorsDirty = false;
  }

  // ── 바깥에서 쓰는 기능 ──
  function update() {
    if (!visible || (exploded && !needsWrite)) return;
    needsWrite = false;
    root.updateMatrixWorld(true);
    const mesh = batch.bodies;
    writeMatrices(mesh.instanceMatrix.array, store, nodes, total);
    mesh.count = total;
    markUpload(mesh.instanceMatrix, matrixRange, total * 16);
    if (colorsDirty) flushColors();
  }

  function popBlocks(n) {
    const list = [];
    if (n <= 0 || exploded) return list;
    root.updateMatrixWorld(true);
    for (let k = 0; k < n; k++) {
      let pick = -1;
      for (let p = 0; p < popTotal; p++) {
        if (!store.hidden[popOrder[p]]) {
          pick = popOrder[p];
          break;
        }
      }
      if (pick < 0) pick = randomSpareBlock();
      if (pick < 0) break;
      takeBlock(pick, list);
      if (poppedCount < poppedStack.length) poppedStack[poppedCount++] = pick;
    }
    return list;
  }

  function restoreBlocks(n) {
    let restored = 0;
    while (restored < n && poppedCount > 0 && !exploded) {
      const i = poppedStack[--poppedCount];
      if (!store.hidden[i]) continue;
      store.hidden[i] = 0;
      restoring.add(i, restored * RESTORE_GAP, store);
      restored++;
    }
    return restored;
  }

  function explode() {
    const list = [];
    root.updateMatrixWorld(true);
    for (let i = 0; i < total; i++) {
      if (store.hidden[i] || store.grow[i] === 0) store.hidden[i] = 1;
      else takeBlock(i, list);
    }
    restoring.clear();
    exploded = true;
    needsWrite = true;
    update();
    return list;
  }

  function reset() {
    for (let i = 0; i < total; i++) {
      store.hidden[i] = 0;
      store.dropY[i] = 0;
      store.grow[i] = 1;
    }
    poppedCount = 0;
    restoring.clear();
    exploded = false;
    needsWrite = true;
    update();
  }

  function setFlash(amount, hex = '#FFFFFF') {
    const a = Math.round(Math.min(1, Math.max(0, amount)) * FLASH_STEPS) / FLASH_STEPS;
    if (a === flashAmount && (a === 0 || hex === flashHex)) return;
    if (hex !== flashHex) {
      flashHex = hex;
      flashColor.set(hex).multiplyScalar(FLASH_BOOST);
    }
    flashAmount = a;
    colorsDirty = true;
    if (visible) flushColors();
  }

  function addPart(name, voxels, { parent = null, pivot = [0, 0, 0], at = pivot } = {}) {
    if (parts[name]) removePart(name);
    const parentNode = parent && parts[parent] ? parts[parent] : root;
    const node = new THREE.Group();
    node.name = name;
    attach(node, parentNode, parentNode === root ? null : pivots[parent], at);
    parts[name] = node;
    pivots[name] = at;
    if (total + voxels.length > capacity) allocate(Math.max(Math.ceil(capacity * 1.5), total + voxels.length + 16));
    const nodeIndex = nodes.push(node) - 1;
    const start = total;
    for (const voxel of voxels) writeBlock(total++, nodeIndex, voxel, pivot, KIND_EXTRA);
    extras.push({ name, node, start, count: voxels.length });
    colorsDirty = true;
    needsWrite = true;
    update();
    return node;
  }

  function removePart(name) {
    const index = extras.findIndex((extra) => extra.name === name);
    if (index < 0) return false;
    const { node, start, count } = extras[index];
    extras.splice(index, 1);
    node.removeFromParent();
    delete parts[name];
    delete pivots[name];
    // 뒤쪽 블록을 앞으로 당겨 빈칸 없애기 (귀·몸 블록은 앞쪽이라 번호가 그대로)
    const end = start + count;
    store.offset.copyWithin(start * 3, end * 3, total * 3);
    store.color.copyWithin(start * 3, end * 3, total * 3);
    for (const key of ['node', 'hidden', 'dropY', 'grow', 'kind']) store[key].copyWithin(start, end, total);
    total -= count;
    for (const extra of extras) if (extra.start > start) extra.start -= count;
    const nodeIndex = nodes.indexOf(node);
    nodes.splice(nodeIndex, 1);
    for (let i = 0; i < total; i++) if (store.node[i] > nodeIndex) store.node[i]--;
    batch.bodies.count = total;
    colorsDirty = true;
    needsWrite = true;
    update();
    return true;
  }

  function setVisible(value) {
    visible = !!value;
    root.visible = visible;
    batch.bodies.visible = visible;
    if (visible) {
      needsWrite = true;
      update();
    }
  }

  function dispose() {
    root.removeFromParent();
    scene.remove(batch.bodies);
    batch.bodies.dispose();
  }

  update();

  return {
    root,
    parts,
    pivots,
    addPart,
    removePart,
    update,
    popBlocks,
    restoreBlocks,
    animate: (dt) => restoring.step(dt, store),
    explode,
    reset,
    setFlash,
    setVisible,
    dispose,
    get mesh() {
      return batch.bodies;
    },
    get totalCount() {
      return total;
    },
    get visibleCount() {
      let count = 0;
      for (let i = 0; i < total; i++) if (!store.hidden[i]) count++;
      return count;
    },
    get popTotal() {
      return popTotal;
    },
    get popRemaining() {
      let count = 0;
      for (let p = 0; p < popTotal; p++) if (!store.hidden[popOrder[p]]) count++;
      return count;
    },
    get exploded() {
      return exploded;
    },
    get restoring() {
      return restoring.count > 0;
    },
  };
}
