// 그림 보관함
// 게임에 쓰이는 그림(성, 타워, 몬스터)을 한곳에서 관리합니다.
// 사용자가 올린 그림이 있으면 그 그림을, 없으면 기본 그림을 돌려줍니다.
// 올린 그림은 이 브라우저에 저장되어서 다시 열어도 남아 있습니다.
//
//   art.get(id)              그림 (캔버스/이미지)
//   art.key(id)              그림이 바뀔 때마다 달라지는 이름 (설계도 저장용)
//   art.hasCustom(id)        사용자가 올린 그림이 있는지
//   art.setCustom(id, 그림)   사용자 그림으로 바꾸기
//   art.resetCustom(id)      기본 그림으로 되돌리기
//   ART_ROLES                그림을 쓸 수 있는 자리 목록

import { drawCastle } from '../art/castleArt.js';
import { pixelate } from '../../image/pixelator.js';
import { TOWER_ART } from '../art/towerArt.js';
import { MONSTER_ART } from '../art/monsterArt.js';

export const ART_ROLES = [
  { id: 'castle', label: '우리 성' },
  { id: 'tower:archer', label: '화살 타워' },
  { id: 'tower:cannon', label: '대포 타워' },
  { id: 'tower:ice', label: '얼음 타워' },
  { id: 'monster:custom', label: '내 몬스터 (새로 추가)' },
  { id: 'monster:slime', label: '슬라임' },
  { id: 'monster:bat', label: '박쥐' },
  { id: 'monster:golem', label: '골렘' },
  { id: 'monster:boss', label: '대장 골렘' },
];

const DEFAULTS = {
  castle: drawCastle,
  'tower:archer': TOWER_ART.archer,
  'tower:cannon': TOWER_ART.cannon,
  'tower:ice': TOWER_ART.ice,
  'monster:slime': MONSTER_ART.slime,
  'monster:bat': MONSTER_ART.bat,
  'monster:golem': MONSTER_ART.golem,
  'monster:boss': MONSTER_ART.boss,
  'monster:custom': MONSTER_ART.slime, // 내 몬스터 그림이 없을 때 대신 쓰는 그림
};

const STORAGE_PREFIX = 'blockDefense.art.';
const MAX_SAVED_SIZE = 256; // 저장할 때 그림을 이 크기 안으로 줄임

export async function createArtLibrary() {
  const defaults = new Map();
  const custom = new Map();
  const versions = new Map();

  // 저장해 둔 사용자 그림 불러오기
  await Promise.all(
    ART_ROLES.map(async ({ id }) => {
      const saved = readStorage(STORAGE_PREFIX + id);
      if (!saved) return;
      try {
        const image = await loadImage(saved);
        if (!makesBlocks(image)) throw new Error('블록이 안 생기는 그림');
        custom.set(id, image);
      } catch {
        removeStorage(STORAGE_PREFIX + id);
      }
    }),
  );

  function get(id) {
    if (custom.has(id)) return custom.get(id);
    if (!defaults.has(id)) defaults.set(id, DEFAULTS[id]());
    return defaults.get(id);
  }

  return {
    get,
    key: (id) => `${id}@${custom.has(id) ? 'custom' : 'default'}${versions.get(id) ?? 0}`,
    hasCustom: (id) => custom.has(id),
    async setCustom(id, image) {
      if (!makesBlocks(image)) throw new Error('그림 선이 너무 가늘어서 블록이 생기지 않아요. 색이 칠해진 그림을 써 주세요.');
      const small = shrink(image, MAX_SAVED_SIZE);
      custom.set(id, small);
      versions.set(id, (versions.get(id) ?? 0) + 1);
      writeStorage(STORAGE_PREFIX + id, small.toDataURL('image/png'));
    },
    resetCustom(id) {
      custom.delete(id);
      versions.set(id, (versions.get(id) ?? 0) + 1);
      removeStorage(STORAGE_PREFIX + id);
    },
  };
}

// 작게 블록으로 바꿔도 블록이 몇 개는 생기는 그림인지 확인 (선만 그린 그림은 블록이 0개가 될 수 있음)
const CHECK_COLUMNS = 8;
const MIN_BLOCKS = 4;
export function makesBlocks(image) {
  try {
    const grid = pixelate(image, CHECK_COLUMNS, { maxRows: 40, alphaThreshold: 0.5 });
    return grid.cells.filter(Boolean).length >= MIN_BLOCKS;
  } catch {
    return false;
  }
}

function shrink(image, maxSize) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function loadImage(dataUrl) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  return image;
}

// 브라우저 저장소는 막혀 있을 수도 있어서 실패해도 게임이 멈추지 않게 함
function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 저장 공간이 없으면 이번에만 쓰고 저장은 생략
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 무시
  }
}
