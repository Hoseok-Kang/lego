// 소굴 시설들 (땅 위 블록 시설을 그리고 움직이기)
// 시설 하나 = 블록 묶음 하나(+ 빛나는 블록 묶음 + 빙글빙글 도는 조각들). 소굴 정보(lair)가 바뀌면 달라진 시설만 새로 만듭니다.
// 움직임: 지을 때 블록이 하늘에서 촤르륵 떨어져 쌓이고, 강화하면 통! 튀며 새 블록이 내려앉고,
//         팔면 블록이 위에서부터 퐁퐁 튀어 나가고, 옮기면 폴짝 뛰어 새 자리에 쿵 내려앉습니다.
//
//   const list = createLairBuildings(parent, fx, { onLanded })   parent: 땅판과 같은 묶음, fx: lairFx
//       onLanded(rec, kind)  짓기·강화·옮기기 움직임이 끝나 땅에 닿았을 때 (화면 흔들기용)
//   list.sync(lair, { shift })       시설 목록 맞추기. shift: 땅이 넓어져 모두 밀린 칸 수 (그때는 폴짝 뛰지 않음)
//   list.playBuild(id) / playUpgrade(id) / playRemove(id)
//   list.setSelected(id | null) / setHidden(id, 숨김?)
//   list.update(dt, time) → 그림자를 다시 그려야 하는지 (움직인 것이 있는지)
//   list.pick(ray) → id | null       광선(땅판 기준 좌표)에 맞은 가장 가까운 시설
//   list.get(id) → rec { id, type, level, x, y, art, group … }
//   list.busy(id) → 짓기 · 강화 움직임 중인지      list.rising(id) → 하늘에서 쌓이는 중인지
//   list.anchor(id, out) → out        시설 지붕 위 한가운데 (땅판 기준 좌표, 계책 줄 · 글자 자리)
//   list.dispose()
//
// 움직임 자체는 lairMotion.js, 블록 묶음 만들기는 lairArtMesh.js, 연기 · 불티 나오는 빠르기는 아래 EMIT_EVERY 에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { facilityArt, facilitySize } from './facilityArt.js';
import { rayHitArt } from './lairPick.js';
import { getLairMaterials, footprintCenter } from './lairKit.js';
import { buildArtMeshes, animatePivots, disposeArtMeshes } from './lairArtMesh.js';
import { startBuild, startUpgrade, startRemove, startHop, stepMotion, kick } from './lairMotion.js';

const EMIT_EVERY = { smoke: 0.32, ember: 0.45, spark: 0.8, bubble: 0.55 };

const tmpP = new THREE.Vector3();
const tmpBox = new THREE.Box3();
const tmpHit = new THREE.Vector3();

export function createLairBuildings(parent, fx, { onLanded = null } = {}) {
  const mats = getLairMaterials();
  const recs = new Map();
  let size = 8;
  let selectedId = null;
  const pendingBuild = new Set();
  const pendingUpgrade = new Set();

  function place(rec) {
    footprintCenter(size, rec.x, rec.y, rec.w, rec.h, tmpP);
    rec.group.position.set(tmpP.x, 0, tmpP.z);
  }

  function makeRec(b) {
    const [w, h] = facilitySize(b.type);
    const art = facilityArt(b.type, b.level);
    const rec = {
      id: b.id,
      type: b.type,
      level: b.level,
      x: b.x,
      y: b.y,
      w,
      h,
      art,
      prevArt: null,
      group: new THREE.Group(),
      parts: null,
      anim: null,
      hop: null,
      spring: 0,
      springV: 0,
      emit: new Float32Array(art.emitters.length),
      dying: false,
      gone: false,
      hidden: false,
    };
    rec.group.name = `facility:${b.type}:${b.id}`;
    attachArt(rec);
    place(rec);
    parent.add(rec.group);
    return rec;
  }

  function attachArt(rec) {
    if (rec.parts) {
      rec.group.remove(rec.parts.body);
      disposeArtMeshes(rec.parts);
    }
    rec.parts = buildArtMeshes(rec.art, rec.id === selectedId ? mats.lit : mats.solid, mats.glow);
    rec.group.add(rec.parts.body);
    rec.emit = new Float32Array(rec.art.emitters.length);
  }

  function disposeRec(rec) {
    parent.remove(rec.group);
    disposeArtMeshes(rec.parts);
    recs.delete(rec.id);
  }

  function sync(lair, { shift = 0 } = {}) {
    size = lair.size;
    const seen = new Set();
    for (const b of lair.buildings) {
      seen.add(b.id);
      let rec = recs.get(b.id);
      if (rec && rec.type !== b.type) {
        disposeRec(rec);
        rec = null;
      }
      if (!rec) {
        rec = makeRec(b);
        recs.set(b.id, rec);
        if (pendingBuild.delete(b.id)) startBuild(rec);
        continue;
      }
      rec.gone = false;
      if (rec.level !== b.level) {
        rec.prevArt = rec.art;
        rec.level = b.level;
        rec.art = facilityArt(b.type, b.level);
        attachArt(rec);
        if (pendingUpgrade.delete(b.id)) startUpgrade(rec, fx);
      }
      const moved = b.x - shift !== rec.x || b.y - shift !== rec.y;
      const from = moved ? rec.group.position.clone() : null;
      rec.x = b.x;
      rec.y = b.y;
      place(rec);
      if (moved && !rec.dying) startHop(rec, from);
    }
    for (const rec of recs.values()) if (!seen.has(rec.id)) rec.gone = true;
  }

  function update(dt, time) {
    let moved = false;
    for (const rec of recs.values()) {
      if (rec.gone && !rec.dying) {
        disposeRec(rec);
        moved = true;
        continue;
      }
      const step = stepMotion(rec, dt, fx, onLanded);
      if (step === 'removed') {
        disposeRec(rec);
        moved = true;
        continue;
      }
      if (step) moved = true;
      rec.prevArt = null; // 강화 움직임은 단계가 바뀐 그 순간에만 고를 수 있음
      if (rec.hidden || rec.dying) continue;
      animatePivots(rec.parts.pivots, time);
      emit(rec, dt);
    }
    return moved;
  }

  function emit(rec, dt) {
    const list = rec.art.emitters;
    if (!list.length || (rec.anim && rec.anim.kind === 'build')) return;
    const g = rec.group.position;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      rec.emit[i] += dt;
      const every = EMIT_EVERY[e.kind] ?? 0.6;
      if (rec.emit[i] < every) continue;
      rec.emit[i] -= every * (0.7 + Math.random() * 0.6);
      const x = g.x + e.x;
      const y = g.y + e.y;
      const z = g.z + e.z;
      if (e.kind === 'smoke') fx.smoke(x, y, z, rec.type === 'factory' ? (Math.random() < 0.5 ? '#BBE90B' : '#A0BCAC') : '#6C6E68');
      else if (e.kind === 'ember') fx.ember(x, y, z, Math.random() < 0.6 ? '#FE8A18' : '#FFF03A');
      else if (e.kind === 'spark') fx.sparkle(x, y, z, 2, rec.type === 'vault' ? '#FFF03A' : '#9FC3E9', { spread: 0.8, up: 2.5, life: 0.5, size: 0.7 });
      else if (e.kind === 'bubble') fx.sparkle(x, y, z, 1, '#BBE90B', { spread: 0.3, up: 2, life: 0.9, size: 0.8, gravity: -0.03 });
    }
  }

  // 광선이 처음 만나는 시설 블록 (상자로 먼저 거르고, 블록 칸까지 정확히)
  function pick(ray) {
    let best = null;
    let bestD = Infinity;
    const o = ray.origin;
    const d = ray.direction;
    for (const rec of recs.values()) {
      if (rec.hidden || rec.dying || rec.gone) continue;
      const b = rec.art.pick;
      const g = rec.group.position;
      tmpBox.min.set(g.x + b.minX, 0, g.z + b.minZ);
      tmpBox.max.set(g.x + b.maxX, b.maxY, g.z + b.maxZ);
      if (!ray.intersectBox(tmpBox, tmpHit)) continue;
      const t = rayHitArt(rec.art, o.x - g.x, o.y - g.y, o.z - g.z, d.x, d.y, d.z, bestD);
      if (t !== null && t < bestD) {
        bestD = t;
        best = rec.id;
      }
    }
    return best === null ? null : { id: best, distance: bestD };
  }

  function setSelected(id) {
    if (selectedId === id) return;
    const old = recs.get(selectedId);
    selectedId = id;
    if (old) old.parts.solid.material = mats.solid;
    const rec = recs.get(id);
    if (rec) {
      rec.parts.solid.material = mats.lit;
      kick(rec, -1.4);
    }
  }

  return {
    sync,
    update,
    pick,
    setSelected,
    get: (id) => recs.get(id) ?? null,
    // 짓기 · 강화 움직임 중인지 (계책 번쩍임을 다 쌓인 뒤로 미루려고)
    busy(id) {
      const rec = recs.get(id);
      return !!rec && !!rec.anim && rec.anim.kind !== 'remove';
    },
    // 하늘에서 쌓이는 중인지 (아직 다 안 지어졌으면 계책 줄을 잇지 않음)
    rising(id) {
      return recs.get(id)?.anim?.kind === 'build';
    },
    get records() {
      return recs;
    },
    setHidden(id, hidden) {
      const rec = recs.get(id);
      if (!rec) return;
      rec.hidden = hidden;
      rec.group.visible = !hidden;
    },
    anchor(id, out) {
      const rec = recs.get(id);
      if (!rec) return null;
      const g = rec.group.position;
      return out.set(g.x, g.y + Math.min(rec.art.height, rec.w > 1 ? 7 : 5) + 1.2, g.z);
    },
    playBuild(id) {
      const rec = recs.get(id);
      if (rec && !rec.dying) startBuild(rec);
      else pendingBuild.add(id);
    },
    playUpgrade(id) {
      // 단계가 이미 바뀌었으면 바로, 아직이면 다음 sync 에서 단계가 바뀔 때
      const rec = recs.get(id);
      if (rec && rec.prevArt && !rec.dying) startUpgrade(rec, fx);
      else pendingUpgrade.add(id);
    },
    playRemove(id) {
      const rec = recs.get(id);
      if (rec && !rec.dying) startRemove(rec, fx);
    },
    dispose() {
      for (const rec of [...recs.values()]) disposeRec(rec);
    },
  };
}
