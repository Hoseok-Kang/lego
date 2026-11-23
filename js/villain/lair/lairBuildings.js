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
//   list.anchor(id, out) → out        시설 지붕 위 한가운데 (땅판 기준 좌표, 계책 줄 · 글자 자리)
//   list.dispose()
//   buildArtMeshes(art, 보통재질, 빛재질, { shadow }) → { body, meshes, pivots }   (유령 미리보기도 같이 씀)
//
// 떨어지는 높이 · 빠르기 · 튀는 정도는 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { facilityArt, facilitySize } from './facilityArt.js';
import { TILE, getLairMaterials, createVoxelMesh, footprintCenter, ZERO_MATRIX, seededRandom } from './lairKit.js';

const DROP = 15; // 블록이 떨어지기 시작하는 높이
const FALL = 0.3; // 블록 하나가 떨어지는 시간
const BOUNCE = 0.16; // 내려앉은 뒤 톡 튀는 시간
const SCATTER = 2.2; // 떨어지기 시작할 때 옆으로 흩어진 정도
const SPIN = 2.4; // 떨어지며 도는 정도
const BUILD_SECONDS = [1.1, 2.6]; // 짓는 시간 (블록이 적을 때 ~ 많을 때)
const UPGRADE_SECONDS = 1.1;
const REMOVE_SECONDS = [0.7, 1.3];
const HOP_SECONDS = 0.5; // 옮길 때 폴짝 뛰는 시간
const HOP_HEIGHT = 5;
const SPRING = 170; // 통! 튀는 스프링 세기
const SPRING_DAMP = 9;
const EMIT_EVERY = { smoke: 0.32, ember: 0.45, spark: 0.8, bubble: 0.55 };

const tmpM = new THREE.Matrix4();
const tmpP = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpBox = new THREE.Box3();
const tmpHit = new THREE.Vector3();
const AXES = { x: 'x', y: 'y', z: 'z' };

export function buildArtMeshes(art, solidMat, glowMat, { shadow = true } = {}) {
  const body = new THREE.Group();
  const meshes = [];
  const solid = createVoxelMesh(art.solid, solidMat, { shadow });
  body.add(solid);
  meshes.push(solid);
  let glow = null;
  if (art.glow.length) {
    glow = createVoxelMesh(art.glow, glowMat, { shadow: false });
    body.add(glow);
    meshes.push(glow);
  }
  const pivots = art.anims.map((def) => {
    const group = new THREE.Group();
    group.position.set(def.pivot.x, def.pivot.y, def.pivot.z);
    if (def.solid.length) group.add(createVoxelMesh(def.solid, solidMat, { shadow: false }));
    if (def.glow.length) group.add(createVoxelMesh(def.glow, glowMat, { shadow: false }));
    body.add(group);
    return { group, def };
  });
  return { body, solid, glow, meshes, pivots };
}

// 움직이는 조각 한 장면 (돌기 · 둥실 · 흔들 · 빙빙)
export function animatePivots(pivots, time) {
  for (let i = 0; i < pivots.length; i++) {
    const { group, def } = pivots[i];
    const t = time * def.speed + def.phase;
    const axis = AXES[def.axis] ?? 'y';
    if (def.kind === 'spin') group.rotation[axis] = t;
    else if (def.kind === 'swing') group.rotation[axis] = Math.sin(t) * def.amount;
    else if (def.kind === 'bob') group.position.y = def.pivot.y + Math.sin(t) * def.amount;
    else if (def.kind === 'orbit') {
      group.rotation.y = t;
      group.position.y = def.pivot.y + Math.sin(t * 2.3) * def.amount;
    }
  }
}

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
      disposeParts(rec.parts);
    }
    rec.parts = buildArtMeshes(rec.art, rec.id === selectedId ? mats.lit : mats.solid, mats.glow);
    rec.group.add(rec.parts.body);
    rec.emit = new Float32Array(rec.art.emitters.length);
  }

  function disposeRec(rec) {
    parent.remove(rec.group);
    disposeParts(rec.parts);
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
        if (pendingUpgrade.delete(b.id)) startUpgrade(rec);
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

  // ── 짓기: 블록이 아래층부터 하늘에서 떨어져 쌓임 ──
  function startBuild(rec) {
    const n = rec.art.solid.length + rec.art.glow.length;
    const duration = Math.min(BUILD_SECONDS[1], BUILD_SECONDS[0] + n * 0.005);
    rec.anim = makeRain(rec, null, duration, DROP);
    for (const p of rec.parts.pivots) p.group.scale.setScalar(0.001);
  }

  // 떨어질 블록 고르기 (only: 이 열쇠들만 떨어짐, 나머지는 제자리) → 순서 · 시작 시각 · 흩어짐
  function makeRain(rec, only, duration, drop) {
    const list = [];
    const all = [rec.art.solid, rec.art.glow];
    all.forEach((voxels, m) => {
      voxels.forEach((v, i) => {
        if (!only || !only.has(voxelKey(v))) list.push({ m, i, y: v.y, r: 0 });
      });
    });
    const rand = seededRandom(rec.id * 97 + rec.level);
    for (const e of list) e.r = rand();
    list.sort((a, b) => a.y - b.y || a.r - b.r);
    const n = list.length;
    const spread = Math.max(0.05, duration - FALL - BOUNCE);
    const anim = {
      kind: only ? 'upgrade' : 'build',
      t: 0,
      duration,
      drop,
      n,
      mesh: new Uint8Array(n),
      index: new Int32Array(n),
      start: new Float32Array(n),
      scatter: new Float32Array(n * 4),
      landed: 0,
    };
    list.forEach((e, k) => {
      anim.mesh[k] = e.m;
      anim.index[k] = e.i;
      anim.start[k] = spread * Math.pow(n > 1 ? k / (n - 1) : 0, 0.85);
      for (let q = 0; q < 4; q++) anim.scatter[k * 4 + q] = (rand() - 0.5) * (q < 2 ? SCATTER : SPIN);
    });
    // 아직 안 떨어진 블록은 숨김
    for (let k = 0; k < n; k++) meshOf(rec, anim.mesh[k]).setMatrixAt(anim.index[k], ZERO_MATRIX);
    touch(rec);
    return anim;
  }

  function stepRain(rec, anim, dt) {
    anim.t += dt;
    let settled = 0;
    for (let k = 0; k < anim.n; k++) {
      const v = (anim.mesh[k] ? rec.art.glow : rec.art.solid)[anim.index[k]];
      const t = anim.t - anim.start[k];
      const mesh = meshOf(rec, anim.mesh[k]);
      if (t < 0) {
        mesh.setMatrixAt(anim.index[k], ZERO_MATRIX);
        continue;
      }
      let y = 0;
      let s = 1;
      let sx = 0;
      let sz = 0;
      let rx = 0;
      let rz = 0;
      if (t < FALL) {
        const p = t / FALL;
        const fall = 1 - p * p;
        y = anim.drop * fall;
        sx = anim.scatter[k * 4] * fall;
        sz = anim.scatter[k * 4 + 1] * fall;
        rx = anim.scatter[k * 4 + 2] * fall;
        rz = anim.scatter[k * 4 + 3] * fall;
        s = Math.min(1, 0.45 + p * 1.3);
      } else if (t < FALL + BOUNCE) {
        const q = (t - FALL) / BOUNCE;
        const bump = Math.sin(Math.PI * q) * (1 - q);
        y = 0.35 * bump;
        s = 1 + 0.22 * bump;
        settled++;
      } else settled++;
      tmpP.set(v.x + sx, v.y + y, v.z + sz);
      tmpQ.setFromEuler(tmpE.set(rx, 0, rz));
      tmpS.setScalar(s);
      mesh.setMatrixAt(anim.index[k], tmpM.compose(tmpP, tmpQ, tmpS));
    }
    // 새로 내려앉은 블록 몇 개마다 흙먼지
    const landedNow = settled - anim.landed;
    anim.landed = settled;
    if (landedNow > 0 && Math.random() < Math.min(1, landedNow * 0.22)) {
      const g = rec.group.position;
      const a = rec.art;
      fx.dust(g.x + a.bounds.minX + Math.random() * (a.bounds.maxX - a.bounds.minX), 0, g.z + a.bounds.maxZ - 0.3, 2, '#6C6E68');
    }
    touch(rec);
    if (anim.t >= anim.duration) {
      finishAnim(rec);
      return;
    }
    // 움직이는 조각: 거의 다 쌓이면 퐁 나타남
    const tail = (anim.t - anim.duration * 0.8) / (anim.duration * 0.2);
    if (anim.kind === 'build' && tail > 0) for (const p of rec.parts.pivots) p.group.scale.setScalar(easeOutBack(Math.min(1, tail)));
  }

  function finishAnim(rec) {
    const kind = rec.anim?.kind;
    rec.anim = null;
    resetMatrices(rec);
    for (const p of rec.parts.pivots) p.group.scale.setScalar(1);
    kick(rec, kind === 'build' ? 2.4 : 2);
    const g = rec.group.position;
    const top = rec.art.height;
    if (kind === 'build') {
      fx.ring(g.x, 0.25, g.z, '#BBE90B', { radius: rec.w * TILE * 0.85, life: 0.7 });
      fx.sparkle(g.x, top * 0.6, g.z, 26, '#BBE90B', { spread: rec.w * 2.2, up: 7, size: 1 });
      fx.dust(g.x, 0, g.z + (rec.h * TILE) / 2 - 0.5, 6, '#6C6E68');
    } else {
      fx.ring(g.x, 0.25, g.z, '#F2CD37', { radius: rec.w * TILE * 0.9, life: 0.8 });
      fx.sparkle(g.x, top, g.z, 34, '#FFF03A', { spread: rec.w * 2, up: 9, size: 1.1 });
    }
    onLanded?.(rec, kind);
  }

  // ── 강화: 통! 눌렸다 튀고, 새로 생긴 블록이 위에서 내려앉고, 없어진 블록은 퐁 날아감 ──
  function startUpgrade(rec) {
    const prev = rec.prevArt;
    rec.prevArt = null;
    kick(rec, -1.6);
    const g = rec.group.position;
    if (prev) {
      const keep = new Set();
      for (const v of prev.solid) keep.add(voxelKey(v));
      for (const v of prev.glow) keep.add(voxelKey(v));
      const now = new Set();
      for (const v of rec.art.solid) now.add(voxelKey(v));
      for (const v of rec.art.glow) now.add(voxelKey(v));
      for (const list of [prev.solid, prev.glow]) {
        for (const v of list) if (!now.has(voxelKey(v))) fx.pop(g.x + v.x, v.y, g.z + v.z, v.hex, 0.6);
      }
      rec.anim = makeRain(rec, keep, UPGRADE_SECONDS, 9);
    } else {
      rec.anim = { kind: 'upgrade', t: 0, duration: 0.35, n: 0, landed: 0 };
    }
    // 빙글 올라가는 금빛 반짝이
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 4;
      const r = rec.w * TILE * 0.55;
      fx.sparkle(g.x + Math.cos(a) * r, k * 0.4, g.z + Math.sin(a) * r, 1, '#F2CD37', { spread: 0.2, up: 5 + k * 0.4, size: 0.9, life: 1.1 });
    }
  }

  // ── 팔기: 위 블록부터 퐁퐁 튀어 나가며 사라짐 ──
  function startRemove(rec) {
    rec.dying = true;
    const list = [];
    rec.art.solid.forEach((v, i) => list.push({ m: 0, i, y: v.y, r: Math.random() }));
    rec.art.glow.forEach((v, i) => list.push({ m: 1, i, y: v.y, r: Math.random() }));
    list.sort((a, b) => b.y - a.y || a.r - b.r);
    const n = list.length;
    const duration = Math.min(REMOVE_SECONDS[1], REMOVE_SECONDS[0] + n * 0.002);
    const anim = { kind: 'remove', t: 0, duration, n, next: 0, mesh: new Uint8Array(n), index: new Int32Array(n), at: new Float32Array(n) };
    list.forEach((e, k) => {
      anim.mesh[k] = e.m;
      anim.index[k] = e.i;
      anim.at[k] = (duration * 0.85 * k) / Math.max(1, n - 1);
    });
    rec.anim = anim;
    for (const p of rec.parts.pivots) p.group.visible = false;
    const g = rec.group.position;
    fx.sparkle(g.x, rec.art.height * 0.5, g.z, 22, '#F2CD37', { spread: rec.w * 2, up: 8 });
    kick(rec, 1.2);
  }

  function stepRemove(rec, anim, dt) {
    anim.t += dt;
    const g = rec.group.position;
    while (anim.next < anim.n && anim.at[anim.next] <= anim.t) {
      const k = anim.next++;
      const list = anim.mesh[k] ? rec.art.glow : rec.art.solid;
      const v = list[anim.index[k]];
      meshOf(rec, anim.mesh[k]).setMatrixAt(anim.index[k], ZERO_MATRIX);
      if (k % 2 === 0 || anim.n < 120) fx.pop(g.x + v.x, v.y, g.z + v.z, v.hex, 1);
    }
    touch(rec);
    if (anim.t >= anim.duration) {
      const s = rec.w * TILE;
      fx.dust(g.x, 0, g.z, 8, '#A0A5A9');
      fx.ring(g.x, 0.25, g.z, '#F2CD37', { radius: s * 0.8, life: 0.6 });
      disposeRec(rec);
    }
  }

  // ── 옮기기: 옛 자리에서 폴짝 뛰어 새 자리에 쿵 ──
  function startHop(rec, from) {
    rec.hop = { t: 0, fx: from.x, fz: from.z, tx: rec.group.position.x, tz: rec.group.position.z };
    rec.group.position.copy(from);
    kick(rec, -1.2);
  }

  function stepHop(rec, dt) {
    const hop = rec.hop;
    hop.t += dt / HOP_SECONDS;
    const t = Math.min(1, hop.t);
    const e = t * t * (3 - 2 * t);
    rec.group.position.set(hop.fx + (hop.tx - hop.fx) * e, Math.sin(Math.PI * t) * HOP_HEIGHT, hop.fz + (hop.tz - hop.fz) * e);
    if (t >= 1) {
      rec.hop = null;
      rec.group.position.y = 0;
      kick(rec, 2.2);
      fx.dust(hop.tx, 0, hop.tz + (rec.h * TILE) / 2 - 0.5, 6, '#6C6E68');
      onLanded?.(rec, 'move');
    }
  }

  function kick(rec, amount) {
    rec.springV += amount;
  }

  function update(dt, time) {
    let moved = false;
    for (const rec of recs.values()) {
      if (rec.gone && !rec.dying) {
        disposeRec(rec);
        moved = true;
        continue;
      }
      if (rec.anim) {
        moved = true;
        if (rec.anim.kind === 'remove') {
          stepRemove(rec, rec.anim, dt);
          if (!recs.has(rec.id)) continue;
        } else stepRain(rec, rec.anim, dt);
      }
      if (rec.hop) {
        moved = true;
        stepHop(rec, dt);
      }
      // 통! 스프링 (위아래로 눌렸다 늘어남)
      if (Math.abs(rec.spring) > 0.0005 || Math.abs(rec.springV) > 0.0005) {
        rec.springV += (-SPRING * rec.spring - SPRING_DAMP * rec.springV) * dt;
        rec.spring += rec.springV * dt;
        const s = Math.max(-0.35, Math.min(0.35, rec.spring * 0.12));
        rec.parts.body.scale.set(1 - s * 0.5, 1 + s, 1 - s * 0.5);
        moved = true;
      } else if (rec.parts.body.scale.y !== 1) rec.parts.body.scale.set(1, 1, 1);
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

  function pick(ray) {
    let best = null;
    let bestD = Infinity;
    for (const rec of recs.values()) {
      if (rec.hidden || rec.dying || rec.gone) continue;
      const b = rec.art.bounds;
      const g = rec.group.position;
      tmpBox.min.set(g.x + b.minX, 0, g.z + b.minZ);
      tmpBox.max.set(g.x + b.maxX, Math.max(1.2, b.maxY), g.z + b.maxZ);
      if (!ray.intersectBox(tmpBox, tmpHit)) continue;
      const d = tmpHit.distanceTo(ray.origin);
      if (d < bestD) {
        bestD = d;
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
      if (rec && rec.prevArt && !rec.dying) startUpgrade(rec);
      else pendingUpgrade.add(id);
    },
    playRemove(id) {
      const rec = recs.get(id);
      if (rec && !rec.dying) startRemove(rec);
    },
    dispose() {
      for (const rec of [...recs.values()]) disposeRec(rec);
    },
  };
}

function meshOf(rec, m) {
  return m ? rec.parts.glow : rec.parts.solid;
}

function resetMatrices(rec) {
  const lists = [rec.art.solid, rec.art.glow];
  for (let m = 0; m < 2; m++) {
    const mesh = meshOf(rec, m);
    if (!mesh) continue;
    const list = lists[m];
    for (let i = 0; i < list.length; i++) mesh.setMatrixAt(i, tmpM.makeTranslation(list[i].x, list[i].y, list[i].z));
    mesh.instanceMatrix.needsUpdate = true;
  }
}

function touch(rec) {
  rec.parts.solid.instanceMatrix.needsUpdate = true;
  if (rec.parts.glow) rec.parts.glow.instanceMatrix.needsUpdate = true;
}

function disposeParts(parts) {
  parts.body.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
  });
}

function voxelKey(v) {
  return `${v.x},${v.y},${v.z},${v.hex}`;
}

function easeOutBack(t) {
  const c = 1.9;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}
