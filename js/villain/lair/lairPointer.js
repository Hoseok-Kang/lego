// 소굴 누르기 → 칸 · 시설 고르기 (손가락 · 마우스)
// 화면 점에서 광선을 쏘아 땅(윗면 높이 0)과 시설 블록 중 먼저 닿는 것을 고릅니다. 시설은 블록 하나하나까지 정확히(lairPick.js).
// 짓는 중에는 땅만 보고, 손가락 아래 칸이 시설의 맨 아래 줄이 되게 유령 자리를 정합니다 (손가락에 유령이 가려지지 않게).
// 컴퓨터 마우스: 올려만 놓아도 시설 · 칸 테두리가 보이고, 짓는 중에는 유령이 따라다닙니다.
//
//   const pointer = createLairPointer(canvas, { cam, world, buildings, marks, state, onTap, onGhostMove })
//       state() → { landSize, placing: { w, h } | null, owners: Int32Array (칸마다 시설 id, 빈칸 -1) }
//       onTap(spot) / onGhostMove(spot | null)  spot = { x, y, buildingId, tileX, tileY } (lairView.js 머리말 참고)
//   pointer.pickAt(clientX, clientY) → spot | null
//   pointer.setGhostKey(x, y)   유령이 지금 있는 칸 (같은 칸이면 다시 알리지 않음)
//   pointer.cancelGesture()     지금 누르는 것을 없던 일로 (두 손가락 확대가 시작됨) → 누를 때 옮겨진 유령도 제자리로
//   pointer.dispose()

import * as THREE from '../../lib/three.js';
import { TILE } from './lairKit.js';
import { createLairInput } from './lairInput.js';

export function createLairPointer(canvas, { cam, world, buildings, marks, state, onTap, onGhostMove }) {
  const localRay = new THREE.Ray();
  let lastGhostKey = '';
  let hoverKey = '';
  let beforePress = null; // 누르기 직전 유령 칸 (두 손가락 확대로 바뀌면 되돌림)

  function groundAt(clientX, clientY) {
    const { landSize } = state();
    const ray = cam.pointerRay(clientX, clientY);
    localRay.origin.copy(ray.origin).sub(world.position);
    localRay.direction.copy(ray.direction);
    if (localRay.direction.y > -1e-4) return null;
    const t = -localRay.origin.y / localRay.direction.y;
    const px = localRay.origin.x + localRay.direction.x * t;
    const pz = localRay.origin.z + localRay.direction.z * t;
    return { t, fx: px / TILE + landSize / 2, fy: pz / TILE + landSize / 2 };
  }

  // 손가락 아래 칸이 시설의 맨 아래 줄 (가로는 가운데) → 유령이 손가락 위쪽에 보여서 가려지지 않음
  function placingSpot(hit) {
    const { landSize, placing } = state();
    const { w, h } = placing;
    const x = Math.max(0, Math.min(landSize - w, Math.round(hit.fx - w / 2 + 1e-6)));
    const y = Math.max(0, Math.min(landSize - h, Math.floor(hit.fy) - (h - 1)));
    return { x, y };
  }

  function pickAt(clientX, clientY) {
    const { landSize, placing, owners } = state();
    const hit = groundAt(clientX, clientY);
    if (placing) {
      if (!hit) return null;
      const spot = placingSpot(hit);
      return { x: spot.x, y: spot.y, buildingId: null, tileX: Math.floor(hit.fx), tileY: Math.floor(hit.fy) };
    }
    const building = buildings.pick(localRay);
    if (building && (!hit || building.distance <= hit.t + 0.5)) {
      const rec = buildings.get(building.id);
      return { x: rec.x, y: rec.y, buildingId: building.id, tileX: hit ? Math.floor(hit.fx) : rec.x, tileY: hit ? Math.floor(hit.fy) : rec.y };
    }
    if (!hit) return { x: null, y: null, buildingId: null, tileX: null, tileY: null };
    const tx = Math.floor(hit.fx);
    const ty = Math.floor(hit.fy);
    if (tx < 0 || ty < 0 || tx >= landSize || ty >= landSize) return { x: null, y: null, buildingId: null, tileX: tx, tileY: ty };
    const owner = owners[ty * landSize + tx];
    return { x: tx, y: ty, buildingId: owner >= 0 ? owner : null, tileX: tx, tileY: ty };
  }

  function ghostFollow(clientX, clientY, final) {
    const spot = pickAt(clientX, clientY);
    if (!spot) return;
    const key = `${spot.x},${spot.y}`;
    if (key === lastGhostKey && !final) return;
    const changed = key !== lastGhostKey;
    lastGhostKey = key;
    if (changed) marks.moveGhost(spot.x, spot.y, state().landSize, { valid: marks.ghost?.valid ?? true });
    if (onGhostMove) {
      if (changed) onGhostMove({ x: spot.x, y: spot.y });
    } else if (final) onTap?.(spot);
  }

  const input = createLairInput(canvas, {
    onPress(x, y) {
      if (!state().placing) return;
      beforePress = lastGhostKey;
      ghostFollow(x, y, false);
    },
    onDrag(x, y) {
      if (state().placing) ghostFollow(x, y, false);
    },
    onRelease(x, y, wasDrag) {
      if (state().placing && wasDrag) ghostFollow(x, y, true);
    },
    onTap(x, y) {
      const spot = pickAt(x, y);
      if (spot) onTap?.(spot);
    },
    onHover(x, y) {
      const { placing, landSize } = state();
      if (placing) return ghostFollow(x, y, false);
      const spot = pickAt(x, y);
      const key = spot ? `${spot.x},${spot.y},${spot.buildingId}` : '';
      if (key === hoverKey) return;
      hoverKey = key;
      const rec = spot?.buildingId != null ? buildings.get(spot.buildingId) : null;
      if (rec) marks.hover(rec.x, rec.y, rec.w, rec.h, landSize);
      else if (spot && spot.x !== null) marks.hover(spot.x, spot.y, 1, 1, landSize);
      else marks.hover(null);
      canvas.style.cursor = rec ? 'pointer' : '';
    },
    onLeave() {
      hoverKey = '';
      marks.hover(null);
    },
  });


  return {
    pickAt,
    setGhostKey(x, y) {
      lastGhostKey = `${x},${y}`;
    },
    cancelGesture() {
      input.cancel();
      if (!state().placing || !beforePress || beforePress === lastGhostKey) return;
      const [x, y] = beforePress.split(',').map(Number);
      lastGhostKey = beforePress;
      marks.moveGhost(x, y, state().landSize, { valid: marks.ghost?.valid ?? true });
      onGhostMove?.({ x, y });
    },
    dispose: () => input.dispose(),
  };
}
