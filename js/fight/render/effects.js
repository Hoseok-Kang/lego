// 싸움 효과 모음 (총구 불꽃, 불티, 칼 자국, '펑' 고리, 빨간 경고 원, '!' 표시, 조준 점선, 착지 먼지)
// 모든 효과는 미리 만들어 둔 조각을 돌려 써서 가볍습니다. 매 장면 fx.update(dt) 만 불러 주면 됩니다.
//
//   const fx = createEffects(scene, { pitchDeg })   pitchDeg: 카메라 내려다보는 각도 ('!' 를 카메라 쪽으로 눕힘)
//   fx.muzzleFlash(위치, facing, 색)         총구에서 번쩍 + 불티
//   fx.hitSpark(위치, 색)                    맞은 자리에 작은 불티
//   fx.slashArc(위치, facing, 부채꼴각도, 닿는거리, 방향 ±1)   칼 휘두른 자리에 반투명한 띠 (약 0.2초)
//                                            위치 높이(y)가 0.5 보다 낮으면 칼 높이 SLASH_HEIGHT 에 그림
//   fx.popRing(위치, 크기 = 1)               토끼가 '펑' 할 때 퍼지는 고리 + 연기 + 색종이
//   fx.telegraph(위치, 반지름, 초) → { cancel(), done }   바닥에 빨간 원이 차오름 (망치 내려치기 예고)
//   fx.alert(followFn, 초, 올림 = 19)        머리 위 빨간 '!' (followFn() → Vector3, 바닥 위치(y<1)면 '올림' 칸 위로,
//                                            null 이면 그 장면에는 숨김 — 예: 토끼가 터짐)
//   fx.aimLine(from, to, 보이기)              흐릿한 조준 점선 (매 장면)
//   fx.dust(위치, 크기 = 1)                   깡충 착지할 때 발밑 먼지 (rabbitRig 의 onLand 에 연결)
//   fx.update(dt) ; fx.clear()               clear: 다시 하기 할 때 남은 효과 모두 지우기
//
// 효과의 크기·개수·색은 아래 상수에서 바꿉니다. (색은 장난감 블록 색 목록에서 고름)

import * as THREE from '../../lib/three.js';
import { FIGHT } from '../fightConfig.js';
import { createParticles, SPARK, PUFF, FLASH, RAY } from './fxParticles.js';
import { createSlashes } from './fxSlash.js';
import { createGroundFx } from './fxGround.js';
import { createMarks } from './fxMarks.js';

const WHITE = '#F4F4F4';
const SHINE = '#FFF03A'; // 번쩍 색 (연노랑)
const PINK = '#E4ADC8';
const CREAM = '#F6D7B3';
const CORAL = '#FF698F';
const SAND = '#E4CD9E';
const CONFETTI = ['#F2CD37', '#FF698F', '#9FC3E9', '#F4F4F4', '#BBE90B', '#AC78BA'];

const SLASH_HEIGHT = 5.3 * FIGHT.figureScale; // 칼 자국을 그리는 높이 (위치를 바닥으로 받았을 때)
const MUZZLE_SPARKS = 5; // 총구 불티 수
const HIT_SPARKS = 7; // 맞은 자리 불티 수
const POP_PUFFS = 12; // '펑' 연기 덩어리 수
const POP_RAYS = 10; // '펑' 빛줄기 수
const POP_CONFETTI = 18; // '펑' 색종이 수
const DUST_PUFFS = 5; // 착지 먼지 수
const DUST_SPREAD = 2.8; // 착지 먼지가 생기는 거리 (발밑에서, 몸에 가려지지 않게)

export function createEffects(scene, { pitchDeg = FIGHT.camera.pitchDeg } = {}) {
  const particles = createParticles(scene, { capacity: 520 }); // 밝게 빛나는 불티·번쩍
  // 연기·먼지: 빛을 받는 동글동글 솜뭉치
  const puffs = createParticles(scene, {
    capacity: 160,
    geometry: new THREE.IcosahedronGeometry(0.5, 1),
    material: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, flatShading: true }),
  });
  const slashes = createSlashes(scene);
  const ground = createGroundFx(scene);
  const marks = createMarks(scene, { pitchDeg });

  // 색 이름 → Color (처음 한 번만 만듦)
  const colors = new Map();
  const colorOf = (hex) => {
    let color = colors.get(hex);
    if (!color) {
      color = new THREE.Color(hex);
      colors.set(hex, color);
    }
    return color;
  };
  const rand = (min, max) => min + Math.random() * (max - min);

  function muzzleFlash(position, facing, hex = SHINE) {
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    const { x, y, z } = position;
    particles.spawn(x + fx * 0.4, y, z + fz * 0.4, fx * 4, 0, fz * 4, 1.25, 0.07, colorOf(SHINE), 0, 0, FLASH);
    particles.spawn(x + fx * 0.3, y, z + fz * 0.3, 0, 0, 0, 0.7, 0.055, colorOf(WHITE), 0, 0, FLASH);
    // 앞으로 뻗는 빛줄기 (가운데 하나는 길게)
    particles.spawn(x + fx * 1.6, y, z + fz * 1.6, fx * 30, 0, fz * 30, 3.6, 0.07, colorOf(SHINE), 0, 8, RAY);
    for (let i = 0; i < MUZZLE_SPARKS; i++) {
      const angle = facing + (Math.random() - 0.5) * 1.2;
      const speed = rand(18, 32);
      const sx = Math.sin(angle);
      const sz = Math.cos(angle);
      particles.spawn(x + sx * 0.9, y, z + sz * 0.9, sx * speed, rand(-1, 4), sz * speed, rand(1.3, 2), rand(0.07, 0.13), colorOf(i % 2 ? hex : SHINE), 0, 7, RAY);
    }
    puffs.spawn(x + fx * 0.8, y, z + fz * 0.8, fx * 3, 2.5, fz * 3, 0.8, 0.26, colorOf(WHITE), 0, 4, PUFF);
  }

  function hitSpark(position, hex = WHITE) {
    const { x, y, z } = position;
    particles.spawn(x, y, z, 0, 0, 0, 1.1, 0.07, colorOf(WHITE), 0, 0, FLASH);
    const turn = Math.random() * Math.PI * 2;
    for (let i = 0; i < HIT_SPARKS; i++) {
      const angle = turn + (i / HIT_SPARKS) * Math.PI * 2 + Math.random() * 0.5;
      const speed = rand(18, 30);
      const color = i % 3 === 0 ? WHITE : i % 3 === 1 ? hex : SHINE;
      const sx = Math.sin(angle);
      const sz = Math.cos(angle);
      particles.spawn(x + sx, y, z + sz, sx * speed, rand(2, 9), sz * speed, rand(1.7, 2.5), rand(0.1, 0.16), colorOf(color), 0, 9, RAY);
    }
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.spawn(x, y, z, Math.sin(angle) * 7, rand(6, 11), Math.cos(angle) * 7, rand(0.3, 0.42), rand(0.25, 0.35), colorOf(i ? hex : SHINE), 35, 1, SPARK);
    }
  }

  function slashArc(position, facing, arcRad, range, side = 1) {
    const y = position.y >= 0.5 ? position.y : SLASH_HEIGHT;
    slashes.spawn(position.x, y, position.z, facing, arcRad, range, side);
    // 띠 바깥 테두리를 따라 반짝이 몇 개
    const dir = side < 0 ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      const f = (i + 0.5) / 4;
      const a = facing - dir * arcRad * 0.5 + dir * arcRad * f;
      const r = range * rand(0.85, 1);
      const tx = Math.cos(a) * dir;
      const tz = -Math.sin(a) * dir;
      particles.spawn(position.x + Math.sin(a) * r, y + 0.4, position.z + Math.cos(a) * r, tx * 5, rand(1, 3), tz * 5, rand(0.22, 0.34), rand(0.16, 0.24), colorOf(i % 2 ? WHITE : SHINE), 0, 4, SPARK);
    }
  }

  function popRing(position, scale = 1) {
    const s = scale;
    const { x, z } = position;
    ground.ring(x, z, 1.5 * s, 12 * s, 0.5, colorOf(WHITE), true, 0.85);
    ground.ring(x, z, 1 * s, 8 * s, 0.42, colorOf(CORAL), false, 0.95);
    particles.spawn(x, 6 * s, z, 0, 0, 0, 3.2 * s, 0.1, colorOf(WHITE), 0, 0, FLASH);
    particles.spawn(x, 6 * s, z, 0, 0, 0, 2 * s, 0.08, colorOf(SHINE), 0, 0, FLASH);
    // 사방으로 뻗는 빛줄기 ('펑!' 별 모양)
    const turn = Math.random() * Math.PI;
    for (let i = 0; i < POP_RAYS; i++) {
      const angle = turn + (i / POP_RAYS) * Math.PI * 2;
      const up = i % 2 ? 0.35 : 0.9;
      particles.spawn(x, 6 * s, z, Math.sin(angle) * 34 * s, 34 * up * s, Math.cos(angle) * 34 * s, rand(3.2, 4.4) * s, rand(0.14, 0.2), colorOf(i % 2 ? WHITE : SHINE), 0, 6, RAY);
    }
    for (let i = 0; i < POP_PUFFS; i++) {
      const angle = (i / POP_PUFFS) * Math.PI * 2 + Math.random() * 0.5;
      const speed = rand(5, 11) * s;
      const color = i % 3 === 0 ? PINK : i % 3 === 1 ? WHITE : CREAM;
      puffs.spawn(
        x + Math.sin(angle) * 1.5 * s,
        rand(2, 8) * s,
        z + Math.cos(angle) * 1.5 * s,
        Math.sin(angle) * speed,
        rand(1, 4) * s,
        Math.cos(angle) * speed,
        rand(2.4, 3.8) * s,
        rand(0.5, 0.8),
        colorOf(color),
        0,
        3.5,
        PUFF,
      );
    }
    for (let i = 0; i < POP_CONFETTI; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(8, 20) * s;
      particles.spawn(x, rand(4, 9) * s, z, Math.sin(angle) * speed, rand(10, 22), Math.cos(angle) * speed, rand(0.4, 0.6) * s, rand(0.6, 0.95), colorOf(CONFETTI[i % CONFETTI.length]), 45, 1.5, SPARK);
    }
  }

  function telegraph(position, radius, seconds) {
    return ground.telegraph(position.x, position.z, radius, seconds);
  }

  function dust(position, scale = 1) {
    const s = scale;
    for (let i = 0; i < DUST_PUFFS; i++) {
      const angle = (i / DUST_PUFFS) * Math.PI * 2 + Math.random() * 0.8;
      const speed = rand(5, 8) * s;
      puffs.spawn(
        position.x + Math.sin(angle) * DUST_SPREAD * s,
        0.5 * s,
        position.z + Math.cos(angle) * DUST_SPREAD * s,
        Math.sin(angle) * speed,
        rand(1, 2.5) * s,
        Math.cos(angle) * speed,
        rand(1.1, 1.7) * s,
        rand(0.32, 0.46),
        colorOf(i % 2 ? WHITE : SAND),
        0,
        5,
        PUFF,
      );
    }
  }

  function update(dt) {
    particles.update(dt);
    puffs.update(dt);
    slashes.update(dt);
    ground.update(dt);
    marks.update(dt);
  }

  function clear() {
    particles.clear();
    puffs.clear();
    slashes.clear();
    ground.clear();
    marks.clear();
  }

  return {
    muzzleFlash,
    hitSpark,
    slashArc,
    popRing,
    telegraph,
    alert: marks.alert,
    aimLine: marks.aimLine,
    dust,
    update,
    clear,
  };
}
