// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 3D 작업대: 3D 장면 (블록 · 바닥 눈금 · 테두리 상자 · 지금 장 표시 · 미리 보기 블록)
// 쌓은 블록을 한 번에 그리는 묶음(InstancedMesh 하나)으로 보여 주고, 누른 자리가 어느 블록의 어느 면인지 찾아 줍니다.
//
// 쓰는 법
//   const s = createSculptScene(renderer, { w, h, d })
//   s.scene / s.center (THREE.Vector3, 상자 가운데)
//   s.rebuild(grid)                     블록 다시 놓기 (grid.forEach 를 씀)
//   s.setLayer(z | null)                그 장(앞에서 z 째)을 밝은 틀로 표시
//   s.setGhost(cell | null, kind)       미리 보기 블록 { x, y, z } · kind 'add' (색 hex 와 함께) | 'erase' | 'paint'
//   s.setMirror(on)                     좌우 대칭 가운데 판 보이기
//   s.hit(raycaster) → { cell: {x,y,z}, normal: [dx,dy,dz] } | { floor: {x,y,z} } | null
//   s.cellCenter(x, y, z, out)          그 칸 블록의 가운데 (세상 좌표)
//   s.dispose()
//
// 색 · 투명도는 아래 상수에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import * as THREE from '../../lib/three.js';
import { createBlockBatch } from '../../game/core/blockAssets.js';
import { createStudioLight } from '../../scene/stage.js';

const FLOOR_HEX = 0xd9cff0; // 바닥 판
const LINE_HEX = 0x6a3fd8; // 눈금 · 테두리 줄
const LAYER_HEX = 0xfe8a18; // 지금 장 표시
const MIRROR_HEX = 0xe23a64; // 좌우 대칭 가운데 판

export function createSculptScene(renderer, { w, h, d }) {
  const scene = new THREE.Scene();
  const owned = []; // 지울 때 같이 지울 모양 · 재질
  const keep = (...things) => (owned.push(...things), things[0]);
  scene.environment = keep(createStudioLight(renderer));
  scene.environmentIntensity = 0.55;
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(10, 26, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 18, bottom: -6, near: 1, far: 70 });
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7a6aa0, 0.85), sun, sun.target);

  const center = new THREE.Vector3(0, h / 2, 0);
  const cellCenter = (x, y, z, out = new THREE.Vector3()) => out.set(x - w / 2 + 0.5, h - 1 - y + 0.5, d / 2 - z - 0.5);

  // 바닥 판 + 눈금 (누르면 맨 아랫줄에 블록)
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, d)), keep(new THREE.MeshStandardMaterial({ color: FLOOR_HEX, roughness: 0.9, transparent: true, opacity: 0.75 })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  floor.receiveShadow = true;
  const lines = [];
  for (let x = 0; x <= w; x += 1) lines.push(x - w / 2, 0, -d / 2, x - w / 2, 0, d / 2);
  for (let z = 0; z <= d; z += 1) lines.push(-w / 2, 0, z - d / 2, w / 2, 0, z - d / 2);
  const lineGeo = keep(new THREE.BufferGeometry());
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  const lineMat = keep(new THREE.LineBasicMaterial({ color: LINE_HEX, transparent: true, opacity: 0.22 }));
  const floorLines = new THREE.LineSegments(lineGeo, lineMat);
  floorLines.position.y = 0.005;

  // 쌓을 수 있는 공간 테두리 상자
  const boundsGeo = keep(new THREE.EdgesGeometry(keep(new THREE.BoxGeometry(w, h, d))));
  const bounds = new THREE.LineSegments(boundsGeo, keep(new THREE.LineBasicMaterial({ color: LINE_HEX, transparent: true, opacity: 0.28 })));
  bounds.position.copy(center);

  // 지금 장 (얇은 판 + 테두리)
  const slab = new THREE.Group();
  const slabFill = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, 1)), keep(new THREE.MeshBasicMaterial({ color: LAYER_HEX, transparent: true, opacity: 0.07, depthWrite: false })));
  const slabEdge = new THREE.LineSegments(keep(new THREE.EdgesGeometry(keep(new THREE.BoxGeometry(w, h, 1)))), keep(new THREE.LineBasicMaterial({ color: LAYER_HEX, transparent: true, opacity: 0.85 })));
  slab.add(slabFill, slabEdge);
  slab.position.set(0, h / 2, 0);
  slab.visible = false;

  // 좌우 대칭 가운데 판
  const mirror = new THREE.Mesh(keep(new THREE.PlaneGeometry(d, h)), keep(new THREE.MeshBasicMaterial({ color: MIRROR_HEX, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })));
  mirror.rotation.y = Math.PI / 2;
  mirror.position.copy(center);

  // 미리 보기 블록 (마우스를 올린 자리)
  const ghostMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
  const ghost = new THREE.Mesh(keep(new THREE.BoxGeometry(1.04, 1.04, 1.04)), ghostMat);
  const ghostEdge = new THREE.LineSegments(keep(new THREE.EdgesGeometry(ghost.geometry)), keep(new THREE.LineBasicMaterial({ color: 0x251a3a })));
  ghost.add(ghostEdge);
  ghost.visible = false;

  // 블록 묶음 (빈 자리까지 넉넉히)
  const batch = createBlockBatch(w * h * d, { castShadow: true, receiveShadow: true });
  const blocks = batch.bodies;
  let cellOf = []; // 블록 번호 → { x, y, z }
  scene.add(floor, floorLines, bounds, slab, mirror, ghost, blocks);

  const matrix = new THREE.Matrix4();
  const at = new THREE.Vector3();
  const color = new THREE.Color();
  function rebuild(grid) {
    cellOf = [];
    let n = 0;
    grid.forEach((x, y, z, ch) => {
      matrix.makeTranslation(cellCenter(x, y, z, at));
      blocks.setMatrixAt(n, matrix);
      blocks.setColorAt(n, color.set(hexOf(ch)));
      cellOf.push({ x, y, z });
      n += 1;
    });
    blocks.count = n;
    blocks.instanceMatrix.needsUpdate = true;
    if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;
  }
  let hexOf = () => '#a0a5a9';

  function setLayer(z) {
    slab.visible = Number.isInteger(z);
    if (slab.visible) slab.position.z = d / 2 - z - 0.5;
  }

  function setGhost(cell, kind = 'add', hex = '#ffffff') {
    ghost.visible = !!cell;
    if (!cell) return;
    cellCenter(cell.x, cell.y, cell.z, ghost.position);
    ghostMat.color.set(kind === 'erase' ? '#ff5a4a' : hex);
    ghostMat.opacity = kind === 'add' ? 0.5 : 0.35;
  }

  // 누른 자리 찾기: 블록이면 어느 면인지 (블록 가운데에서 맞은 점까지 가장 긴 쪽), 아니면 바닥 칸
  const local = new THREE.Vector3();
  function hit(raycaster) {
    const found = blocks.count ? raycaster.intersectObject(blocks, false)[0] : null;
    if (found && found.instanceId !== undefined && cellOf[found.instanceId]) {
      const cell = cellOf[found.instanceId];
      local.copy(found.point).sub(cellCenter(cell.x, cell.y, cell.z, at));
      const ax = Math.abs(local.x), ay = Math.abs(local.y), az = Math.abs(local.z);
      let normal;
      if (local.y > 0.44 || (ay >= ax && ay >= az)) normal = [0, local.y > 0 ? -1 : 1, 0]; // y 는 아래로 갈수록 커짐
      else if (ax >= az) normal = [Math.sign(local.x), 0, 0];
      else normal = [0, 0, -Math.sign(local.z)]; // z 는 앞(카메라 쪽)이 0
      return { cell, normal };
    }
    const ground = raycaster.intersectObject(floor, false)[0];
    if (!ground) return null;
    const x = Math.floor(ground.point.x + w / 2);
    const z = Math.floor(d / 2 - ground.point.z);
    if (x < 0 || z < 0 || x >= w || z >= d) return null;
    return { floor: { x, y: h - 1, z } };
  }

  return {
    scene,
    center,
    cellCenter,
    rebuild,
    setLayer,
    setGhost,
    setMirror: (on) => void (mirror.visible = !!on),
    setColors: (fn) => void (hexOf = fn),
    hit,
    dispose() {
      scene.remove(blocks);
      blocks.dispose();
      for (const thing of owned) thing.dispose?.();
      scene.clear();
    },
  };
}
