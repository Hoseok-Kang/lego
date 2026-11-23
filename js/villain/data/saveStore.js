// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 저장 보관함
// 돈, 산 부품, 내가 그린 괴수, 기록, 악당 소굴, 악명, 목표를 브라우저(localStorage)에 넣어 두고 꺼내 씁니다.
// 저장이 막힌 브라우저에서도 게임이 멈추지 않도록 실패하면 메모리에만 들고 있습니다.
//
// 저장 내용 {
//   version: 2, money, ownedParts, designs,
//   stats: { raids, wins, bestPay, blocksBroken, heroesBeaten },
//   lair: { size, nextId, buildings: [{ id, type, x, y, level }] }   (lair/lairSim.js 참고)
//   notoriety: 악명, goalsDone: [목표 키], schemesSeen: [한 번이라도 켠 계책 키], townWins: { 마을 id: 이긴 수 } }
//
// 쓰는 법
//   getSave()          지금 저장 내용
//   update(fn)         fn(save) 안에서 값을 바꾸면 바로 저장 → 바뀐 저장 내용을 돌려줌
//   load() / save()    다시 읽기 / 지금 내용 저장
//   resetAll()         처음 상태로 되돌리기 (가운데 왕좌 + 옆에 괴수 공장)
//   onChange(fn)       저장 내용이 바뀔 때마다 fn(save) 호출 → 그만 듣기 함수를 돌려줌
//   normalizeSave(raw) 아무 저장 내용이나 지금 모양으로 고쳐서 돌려줌 (옛 1단계 저장도 여기서 옮겨짐)
//   saveStore          위 함수들을 한 묶음으로 (다른 모듈에 넘겨줄 때)
//
// 1단계 저장을 처음 열면: 소굴(왕좌 + 공장)을 새로 주고, 그동안의 습격·승리만큼 악명을 선물하고
// (villainConfig.js 의 notoriety.veteran…), 이긴 수를 꼬마 마을 승리로 옮깁니다.
// 땅 크기는 악명 단계에 맞춰 저절로 넓어집니다 (좁아지지는 않음).
// 처음 주는 돈은 villainConfig.js 의 economy.startMoney 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { RANKS, lairSizeFor } from './ranks.js';
import { SCHEMES } from './schemes.js';
import { GOAL_MAP } from './goals.js';
import { startLair, normalizeLair } from '../lair/lairSave.js';

export const SAVE_KEY = 'villainTycoon.save.v1';
export const SAVE_VERSION = 2;

let current = null;
const listeners = new Set();

function defaults() {
  return {
    version: SAVE_VERSION,
    money: VILLAIN.economy.startMoney,
    ownedParts: ['claw'],
    designs: [],
    stats: { raids: 0, wins: 0, bestPay: 0, blocksBroken: 0, heroesBeaten: 0 },
    lair: startLair(),
    notoriety: 0,
    goalsDone: [],
    schemesSeen: [],
    townWins: {},
  };
}

function toCount(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function knownKeys(list, known) {
  return Array.isArray(list) ? [...new Set(list.filter((k) => typeof k === 'string' && known[k]))] : [];
}

function cleanTownWins(raw) {
  const out = {};
  if (raw && typeof raw === 'object') for (const [id, n] of Object.entries(raw)) out[id] = toCount(n, 0);
  return out;
}

// 1단계 저장(버전 없음) → 지금 모양: 그동안 한 습격만큼 악명 선물, 이긴 수 = 꼬마 마을 승리
function migrate(raw, stats) {
  const cfg = VILLAIN.notoriety;
  const out = { ...raw };
  if (!Number.isFinite(Number(raw.notoriety))) {
    const cap = (RANKS[cfg.veteranCapRank]?.at ?? Infinity) - 1;
    out.notoriety = Math.min(cap, stats.raids * cfg.veteranPerRaid + stats.wins * cfg.veteranPerWin);
  }
  if (!raw.townWins && stats.wins > 0) out.townWins = { village: stats.wins };
  if (!Number.isFinite(Number(stats.heroesBeaten))) stats.heroesBeaten = stats.wins;
  return out;
}

// 읽어 온 내용이 망가져 있어도 쓸 수 있는 모양으로 고칩니다
export function normalizeSave(raw) {
  const base = defaults();
  if (!raw || typeof raw !== 'object') return base;
  const owned = Array.isArray(raw.ownedParts) ? raw.ownedParts.filter((t) => typeof t === 'string' && VILLAIN.parts.types[t]) : [];
  for (const type of base.ownedParts) if (!owned.includes(type)) owned.unshift(type);
  const rawStats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  const stats = {
    ...rawStats,
    raids: toCount(rawStats.raids, 0),
    wins: toCount(rawStats.wins, 0),
    bestPay: toCount(rawStats.bestPay, 0),
  };
  const src = (Number(raw.version) || 1) < SAVE_VERSION ? migrate(raw, stats) : raw;
  stats.blocksBroken = toCount(stats.blocksBroken, 0);
  stats.heroesBeaten = toCount(stats.heroesBeaten, 0);
  const notoriety = toCount(src.notoriety, 0);
  const fixed = normalizeLair(src.lair, { minSize: lairSizeFor(notoriety) });
  return {
    ...src,
    version: SAVE_VERSION,
    money: toCount(src.money, base.money) + fixed.refund,
    ownedParts: [...new Set(owned)],
    designs: Array.isArray(src.designs) ? src.designs.filter((d) => d && typeof d === 'object' && Array.isArray(d.cells)) : [],
    stats,
    lair: fixed.lair,
    notoriety,
    goalsDone: knownKeys(src.goalsDone, GOAL_MAP),
    schemesSeen: knownKeys(src.schemesSeen, SCHEMES),
    townWins: cleanTownWins(src.townWins),
  };
}

const normalize = normalizeSave;

function notify() {
  for (const fn of [...listeners]) {
    try {
      fn(current);
    } catch (error) {
      console.error(error);
    }
  }
}

export function load() {
  let raw = null;
  try {
    const text = globalThis.localStorage?.getItem(SAVE_KEY);
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = null;
  }
  current = normalize(raw);
  return current;
}

export function save() {
  if (!current) load();
  try {
    globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
}

export function getSave() {
  return current ?? load();
}

export function update(fn) {
  const state = getSave();
  const result = typeof fn === 'function' ? fn(state) : null;
  if (result && typeof result === 'object' && result !== state) current = normalize(result);
  else current = normalize(state);
  save();
  notify();
  return current;
}

export function resetAll() {
  current = defaults();
  save();
  notify();
  return current;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// 다른 탭(창)에서 저장하면 여기서도 다시 읽음 (서로 덮어써서 괴수가 사라지지 않게)
globalThis.addEventListener?.('storage', (event) => {
  if (event.key !== SAVE_KEY) return;
  load();
  notify();
});

export const saveStore = { load, save, getSave, update, resetAll, onChange, normalizeSave };
export default saveStore;
