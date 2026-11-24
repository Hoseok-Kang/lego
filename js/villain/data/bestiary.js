// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 괴수 도감
// 처음부터 들어 있는 괴수(defaultMonsters.js)와 내가 그린 괴수를 한 목록으로 다룹니다.
//
// 쓰는 법
//   list()               괴수 목록 (내가 그린 것 먼저, 그다음 처음부터 있는 괴수)
//   get(id)              괴수 하나 (없으면 null)
//   saveDesign(design)   저장하고 저장된 괴수를 돌려줌. id 가 없으면 새로 만들고,
//                        처음부터 있는 괴수를 고쳐서 저장하면 '내 괴수'로 복사됩니다 (원본은 그대로)
//   remove(id)           내가 그린 괴수 지우기 (처음부터 있는 괴수는 못 지움 → false)
//   duplicate(id)        복사해서 새 괴수로 저장 → 새 괴수
//   countBlocks(design)  칠한 칸 수 (3D 블록 괴수는 블록 수)
//   designCost(design)   출동 값 = 몸집 점수 × 칸당 값 (올림) + 붙인 부품 값
//   designHp(design) / designSpeed(design) / designStats(design)   체력 · 빠르기 · 전부 (monster/monsterPower.js)
//   isVoxel(design)      3D 블록 괴수인지
//   validate(design)     { ok, message } 괴수로 만들 수 있는 그림인지
//   blankDesign(kind?)   빈 그림 한 장 (kind 'voxel' 이면 빈 3D 작업대)
//   bestiary             위 함수들을 한 묶음으로 (다른 모듈에 넘겨줄 때)
//
// 두께(depths) · 3D 블록(kind 'voxel', voxels) 모양은 data/voxelDesign.js, 몸집 점수는 monster/monsterPower.js 에 설명이 있어요.
// 값과 최소 칸 수는 js/villain/villainConfig.js (monster.costPerBlock, draw.minBlocks, sculpt, parts) 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { DEFAULT_MONSTERS } from './defaultMonsters.js';
import { getSave, update } from './saveStore.js';
import { cleanDepths, cleanVoxels, emptyVoxels, frontCells, voxelBlocks } from './voxelDesign.js';
import { designStats, isVoxelDesign } from '../monster/monsterPower.js';
import { L } from '../lang/lang.js';

// 화면에 보이는 글자 (검사 안내 · 기본 이름)
const TEXT = L({
  ko: {
    defaultName: '내 괴수',
    noDesign: '그림이 없어요.',
    drawFirst: '먼저 괴수를 그려 주세요.',
    needCells: (need, now) => `${need}칸 이상 칠해 주세요. (지금 ${now}칸)`,
    stackFirst: '먼저 블록을 쌓아 주세요.',
    needBlocks: (need, now) => `블록을 ${need}개 이상 쌓아 주세요. (지금 ${now}개)`,
    tooMany: (max, now) => `블록은 ${max}개까지예요. (지금 ${now}개)`,
  },
  en: {
    defaultName: 'My Monster',
    noDesign: 'There is no drawing.',
    drawFirst: 'Draw a monster first.',
    needCells: (need, now) => `Paint at least ${need} blocks. (Now: ${now})`,
    stackFirst: 'Stack some blocks first.',
    needBlocks: (need, now) => `Stack at least ${need} blocks. (Now: ${now})`,
    tooMany: (max, now) => `You can use up to ${max} blocks. (Now: ${now})`,
  },
});
const EMPTY = '.';
const NAME_MAX = 12;

function paletteSet() {
  return new Set(VILLAIN.draw.palette.map((c) => c.ch));
}

// 그림 줄을 정해진 크기와 색 기호로 맞춥니다
function cleanCells(cells, cols, rows) {
  const allowed = paletteSet();
  const out = [];
  for (let r = 0; r < rows; r += 1) {
    const line = typeof cells?.[r] === 'string' ? cells[r] : '';
    let row = '';
    for (let c = 0; c < cols; c += 1) row += allowed.has(line[c]) ? line[c] : EMPTY;
    out.push(row);
  }
  return out;
}

// 칠한 칸 위에 있는 부품만, 정해진 개수까지만 남깁니다
function cleanParts(parts, cells) {
  const out = [];
  const taken = new Set();
  for (const part of Array.isArray(parts) ? parts : []) {
    if (out.length >= (VILLAIN.parts.maxSlots ?? VILLAIN.parts.slots)) break; // 칸 수는 소굴 효과로 늘어날 수 있어 최대치까지 저장
    if (!part || !VILLAIN.parts.types[part.type]) continue;
    const col = Math.round(part.col);
    const row = Math.round(part.row);
    const key = `${col},${row}`;
    if (taken.has(key) || !cells[row] || cells[row][col] === undefined || cells[row][col] === EMPTY) continue;
    taken.add(key);
    out.push({ type: part.type, col, row });
  }
  return out;
}

function cleanName(name) {
  const text = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return text || TEXT.defaultName;
}

export function normalizeDesign(design) {
  const cols = VILLAIN.draw.cols;
  const rows = VILLAIN.draw.rows;
  const voxel = isVoxelDesign(design);
  const voxels = voxel ? cleanVoxels(design.voxels) : null;
  const cells = voxel ? frontCells(voxels) : cleanCells(design?.cells, cols, rows); // 3D 괴수는 앞에서 본 모습
  const out = {
    id: design?.id ?? null,
    name: cleanName(design?.name),
    cols,
    rows,
    cells,
    parts: cleanParts(design?.parts, cells),
    updatedAt: design?.updatedAt ?? 0,
  };
  if (voxel) {
    out.kind = 'voxel';
    out.voxels = voxels;
  } else {
    const depths = cleanDepths(design?.depths, cells); // 모두 자동이면 넣지 않음 (옛 그림과 똑같이)
    if (depths) out.depths = depths;
  }
  if (design?.builtIn) out.builtIn = true;
  return out;
}

function clone(design) {
  const copy = { ...design, cells: [...design.cells], parts: design.parts.map((p) => ({ ...p })) };
  if (design.depths) copy.depths = [...design.depths];
  if (design.voxels) copy.voxels = { ...design.voxels, layers: design.voxels.layers.map((layer) => [...layer]) };
  return copy;
}

function newId() {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function builtIn(id) {
  return DEFAULT_MONSTERS.find((d) => d.id === id) ?? null;
}

function userDesigns() {
  return getSave().designs.map(normalizeDesign);
}

export function blankDesign(kind) {
  if (kind === 'voxel') return normalizeDesign({ id: null, name: TEXT.defaultName, kind: 'voxel', voxels: emptyVoxels(), cells: [], parts: [] });
  return normalizeDesign({ id: null, name: TEXT.defaultName, cells: [], parts: [] });
}

export const isVoxel = isVoxelDesign;

export function list() {
  const mine = userDesigns().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return [...mine, ...DEFAULT_MONSTERS.map(clone)];
}

export function get(id) {
  if (!id) return null;
  const mine = userDesigns().find((d) => d.id === id);
  if (mine) return mine;
  const base = builtIn(id);
  return base ? clone(base) : null;
}

export function countBlocks(design) {
  if (isVoxelDesign(design)) return voxelBlocks(design.voxels);
  let count = 0;
  for (const line of design?.cells ?? []) for (const ch of line) if (ch !== EMPTY) count += 1;
  return count;
}

export function partsCost(parts) {
  let cost = 0;
  for (const part of parts ?? []) cost += VILLAIN.parts.types[part?.type]?.cost ?? 0;
  return cost;
}

// 몸값 = 몸집 점수 × 칸당 값 (반 칸 값은 올림). 두께를 안 건드린 그림은 몸집 점수 = 칸 수 (예전과 같음)
export function designCost(design) {
  return Math.ceil(designStats(design).bodyCost - 1e-9) + partsCost(design?.parts);
}

export const designHp = (design) => designStats(design).hp;
export const designSpeed = (design) => designStats(design).speed;
export { designStats };

export function validate(design) {
  if (!design || !Array.isArray(design.cells)) return { ok: false, message: TEXT.noDesign };
  if (isVoxelDesign(design)) {
    const count = voxelBlocks(cleanVoxels(design.voxels));
    const { minBlocks = 60, maxBlocks = 1600 } = VILLAIN.sculpt ?? {};
    if (count === 0) return { ok: false, message: TEXT.stackFirst };
    if (count < minBlocks) return { ok: false, message: TEXT.needBlocks(minBlocks, count) };
    if (count > maxBlocks) return { ok: false, message: TEXT.tooMany(maxBlocks, count) };
    return { ok: true, message: '' };
  }
  const blocks = countBlocks(normalizeDesign(design));
  const need = VILLAIN.draw.minBlocks;
  if (blocks === 0) return { ok: false, message: TEXT.drawFirst };
  if (blocks < need) return { ok: false, message: TEXT.needCells(need, blocks) };
  return { ok: true, message: '' };
}

export function saveDesign(design) {
  const next = normalizeDesign(design);
  delete next.builtIn;
  // 처음부터 있는 괴수를 고치면 원본은 두고 내 괴수로 복사합니다
  if (!next.id || design?.builtIn || builtIn(next.id)) next.id = newId();
  next.updatedAt = Date.now();
  update((state) => {
    const index = state.designs.findIndex((d) => d.id === next.id);
    if (index >= 0) state.designs[index] = next;
    else state.designs.push(next);
  });
  return clone(next);
}

export function remove(id) {
  if (builtIn(id)) return false;
  let removed = false;
  update((state) => {
    const before = state.designs.length;
    state.designs = state.designs.filter((d) => d.id !== id);
    removed = state.designs.length < before;
  });
  return removed;
}

export function duplicate(id) {
  const source = get(id);
  if (!source) return null;
  const base = source.name.replace(/\s*\d+$/, '').slice(0, NAME_MAX - 2);
  const names = new Set(list().map((d) => d.name));
  let n = 2;
  while (names.has(`${base} ${n}`) && n < 99) n += 1;
  return saveDesign({ ...clone(source), id: null, builtIn: false, name: `${base} ${n}` });
}

export const bestiary = { list, get, saveDesign, remove, duplicate, countBlocks, partsCost, designCost, designHp, designSpeed, designStats, isVoxel, validate, blankDesign, normalizeDesign };
export default bestiary;
