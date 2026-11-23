// 소굴 표시들: 지을 자리 유령(반투명 시설 + 초록/빨강 발자국 칸), 고른 시설 테두리, 마우스가 올라간 칸
// 유령은 땅 위에 살짝 떠서 둥실거리고, 놓을 수 있으면 초록, 못 놓으면 빨강으로 바뀝니다 (바뀔 때 살짝 흔들림).
// 발자국 칸은 시설에 가려도 보이도록 맨 위에 그립니다.
//
//   const marks = createLairMarks(parent)
//   marks.showGhost(type, level)            유령 만들기 (짓기 · 옮기기 시작)
//   marks.moveGhost(x, y, size, { valid, snap })   유령 자리 (왼쪽 위 칸) · 놓을 수 있는지
//   marks.hideGhost()
//   marks.ghost → { type, x, y, w, h, valid, group } | null
//   marks.select(x, y, w, h, size) / marks.select(null)     고른 시설 테두리
//   marks.hover(x, y, w, h, size) / marks.hover(null)       마우스가 올라간 칸 (컴퓨터)
//   marks.update(dt, time)
//   marks.dispose()
//
// 색 · 둥실 높이 · 깜빡임은 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { facilityArt, facilitySize } from './facilityArt.js';
import { TILE, footprintCenter } from './lairKit.js';
import { buildArtMeshes, animatePivots } from './lairBuildings.js';

const OK_COLOR = new THREE.Color('#BBE90B');
const BAD_COLOR = new THREE.Color('#ff3b2f');
const SELECT_COLOR = new THREE.Color('#FFF03A');
const HOVER_COLOR = new THREE.Color('#E1D5ED');
const FLOAT = 0.7; // 유령이 떠 있는 높이
const BOB = 0.25; // 둥실거리는 폭
const FOLLOW = 22; // 유령이 새 자리로 미끄러지는 빠르기
const MAX_TILES = 16;

export function createLairMarks(parent) {
  const fillTex = makeTileTexture(true);
  const frameTex = makeTileTexture(false);
  const tileGeo = new THREE.PlaneGeometry(1, 1);
  tileGeo.rotateX(-Math.PI / 2);

  // 유령 재질 (반투명 + 초록/빨강 빛)
  const ghostMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.4,
    transparent: true,
    opacity: 0.62,
    emissive: OK_COLOR.clone(),
    emissiveIntensity: 0.35,
  });
  const ghostGlow = ghostMat.clone();
  ghostGlow.emissiveIntensity = 0.8;

  // 발자국 칸 (한 칸에 하나)
  const footMat = new THREE.MeshBasicMaterial({ map: fillTex, color: OK_COLOR.clone(), transparent: true, depthTest: false, depthWrite: false });
  const foot = [];
  for (let i = 0; i < MAX_TILES; i++) {
    const m = new THREE.Mesh(tileGeo, footMat);
    m.renderOrder = 15;
    m.visible = false;
    parent.add(m);
    foot.push(m);
  }
  const footGroup = { x: 0, z: 0 };

  // 고른 시설 / 마우스 칸 테두리
  const frame = (color, depthTest) => {
    const mat = new THREE.MeshBasicMaterial({ map: frameTex, color, transparent: true, depthTest, depthWrite: false });
    const m = new THREE.Mesh(tileGeo, mat);
    m.renderOrder = 14;
    m.visible = false;
    parent.add(m);
    return m;
  };
  const selectMark = frame(SELECT_COLOR.clone(), false);
  const hoverMark = frame(HOVER_COLOR.clone(), false);

  let ghost = null;
  let wobble = 0;
  const target = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function showGhost(type, level = 1) {
    hideGhost();
    const art = facilityArt(type, level);
    const [w, h] = facilitySize(type);
    const parts = buildArtMeshes(art, ghostMat, ghostGlow, { shadow: false });
    const group = new THREE.Group();
    group.add(parts.body);
    group.visible = false;
    group.renderOrder = 10;
    parts.body.traverse((o) => (o.renderOrder = 10));
    parent.add(group);
    ghost = { type, level, art, parts, group, w, h, x: 0, y: 0, valid: true, placed: false };
  }

  function hideGhost() {
    if (!ghost) return;
    parent.remove(ghost.group);
    ghost.parts.body.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    ghost = null;
    for (const m of foot) m.visible = false;
  }

  function moveGhost(x, y, size, { valid = true, snap = false } = {}) {
    if (!ghost) return;
    const changed = ghost.valid !== valid;
    ghost.x = x;
    ghost.y = y;
    ghost.valid = valid;
    ghost.size = size;
    footprintCenter(size, x, y, ghost.w, ghost.h, target);
    if (!ghost.placed || snap) {
      ghost.group.position.set(target.x, FLOAT, target.z);
      ghost.placed = true;
    }
    ghost.group.visible = true;
    if (changed && !valid) wobble = 1;
    const color = valid ? OK_COLOR : BAD_COLOR;
    ghostMat.emissive.copy(color);
    ghostGlow.emissive.copy(color);
    footMat.color.copy(color);
    // 발자국 칸: 땅 밖 칸은 언제나 빨강 (재질을 같이 쓰므로 밖 칸은 조금 더 흐리게만)
    let k = 0;
    for (let ty = 0; ty < ghost.h; ty++) {
      for (let tx = 0; tx < ghost.w; tx++) {
        if (k >= MAX_TILES) break;
        const m = foot[k++];
        const gx = x + tx;
        const gy = y + ty;
        m.visible = true;
        m.position.set((gx + 0.5 - size / 2) * TILE, 0.3, (gy + 0.5 - size / 2) * TILE);
        m.userData.outside = gx < 0 || gy < 0 || gx >= size || gy >= size;
      }
    }
    for (; k < MAX_TILES; k++) foot[k].visible = false;
    footGroup.x = target.x;
    footGroup.z = target.z;
  }

  function placeFrame(mark, x, y, w, h, size, pad) {
    if (x === null || x === undefined) {
      mark.visible = false;
      return;
    }
    footprintCenter(size, x, y, w, h, tmp);
    mark.position.set(tmp.x, 0.32, tmp.z);
    mark.scale.set(w * TILE + pad, 1, h * TILE + pad);
    mark.visible = true;
  }

  function update(dt, time) {
    if (ghost && ghost.group.visible) {
      const k = 1 - Math.exp(-dt * FOLLOW);
      const g = ghost.group.position;
      g.x += (target.x - g.x) * k;
      g.z += (target.z - g.z) * k;
      g.y = FLOAT + Math.sin(time * 3.2) * BOB;
      wobble = Math.max(0, wobble - dt * 3);
      ghost.group.rotation.z = Math.sin(time * 40) * 0.05 * wobble;
      animatePivots(ghost.parts.pivots, time);
      const pulse = 0.55 + 0.25 * Math.sin(time * 6);
      footMat.opacity = ghost.valid ? pulse : 0.6 + 0.3 * Math.sin(time * 12);
      ghostMat.emissiveIntensity = 0.3 + 0.15 * Math.sin(time * 4);
      for (const m of foot) {
        if (!m.visible) continue;
        const s = (TILE - 0.3) * (m.userData.outside ? 0.7 : 1 + 0.03 * Math.sin(time * 6));
        m.scale.set(s, 1, s);
      }
    }
    if (selectMark.visible) {
      const s = 1 + 0.035 * Math.sin(time * 5);
      selectMark.material.opacity = 0.75 + 0.25 * Math.sin(time * 5);
      selectMark.scale.x = selectMark.userData.w * s;
      selectMark.scale.z = selectMark.userData.h * s;
    }
    if (hoverMark.visible) hoverMark.material.opacity = 0.45;
  }

  return {
    showGhost,
    moveGhost,
    hideGhost,
    get ghost() {
      return ghost;
    },
    select(x, y, w, h, size) {
      placeFrame(selectMark, x, y, w, h, size, 0.9);
      selectMark.userData.w = selectMark.scale.x;
      selectMark.userData.h = selectMark.scale.z;
    },
    hover(x, y, w, h, size) {
      placeFrame(hoverMark, x, y, w, h, size, 0.2);
    },
    update,
    dispose() {
      hideGhost();
      for (const m of [...foot, selectMark, hoverMark]) {
        parent.remove(m);
        if (m.material !== footMat) m.material.dispose();
      }
      footMat.dispose();
      tileGeo.dispose();
      fillTex.dispose();
      frameTex.dispose();
      ghostMat.dispose();
      ghostGlow.dispose();
    },
  };
}

// 둥근 네모 칸 그림. fill: 안쪽을 옅게 채움 + 굵은 테두리, 아니면 빛나는 테두리만 (색은 재질 색이 곱해짐)
function makeTileTexture(fill) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const r = 22;
  const rect = (inset) => {
    const a = inset;
    const b = size - inset;
    g.beginPath();
    g.moveTo(a + r, a);
    g.arcTo(b, a, b, b, r);
    g.arcTo(b, b, a, b, r);
    g.arcTo(a, b, a, a, r);
    g.arcTo(a, a, b, a, r);
    g.closePath();
  };
  if (fill) {
    rect(8);
    g.fillStyle = 'rgba(255,255,255,0.32)';
    g.fill();
  }
  g.shadowColor = 'rgba(255,255,255,0.9)';
  g.shadowBlur = 12;
  g.lineWidth = fill ? 9 : 8;
  g.strokeStyle = '#ffffff';
  rect(10);
  g.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
