// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 저장 보관함
// 돈, 산 부품, 내가 그린 괴수, 기록을 브라우저(localStorage)에 넣어 두고 꺼내 씁니다.
// 저장이 막힌 브라우저에서도 게임이 멈추지 않도록 실패하면 메모리에만 들고 있습니다.
//
// 쓰는 법
//   getSave()          지금 저장 내용 { money, ownedParts, designs, stats:{raids,wins,bestPay} }
//   update(fn)         fn(save) 안에서 값을 바꾸면 바로 저장 → 바뀐 저장 내용을 돌려줌
//   load() / save()    다시 읽기 / 지금 내용 저장
//   resetAll()         처음 상태로 되돌리기
//   onChange(fn)       저장 내용이 바뀔 때마다 fn(save) 호출 → 그만 듣기 함수를 돌려줌
//   saveStore          위 함수들을 한 묶음으로 (다른 모듈에 넘겨줄 때)
//
// 처음 주는 돈은 js/villain/villainConfig.js 의 economy.startMoney 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';

export const SAVE_KEY = 'villainTycoon.save.v1';

let current = null;
const listeners = new Set();

function defaults() {
  return {
    money: VILLAIN.economy.startMoney,
    ownedParts: ['claw'],
    designs: [],
    stats: { raids: 0, wins: 0, bestPay: 0 },
  };
}

function toCount(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

// 읽어 온 내용이 망가져 있어도 쓸 수 있는 모양으로 고칩니다
function normalize(raw) {
  const base = defaults();
  if (!raw || typeof raw !== 'object') return base;
  const owned = Array.isArray(raw.ownedParts) ? raw.ownedParts.filter((t) => typeof t === 'string' && VILLAIN.parts.types[t]) : [];
  for (const type of base.ownedParts) if (!owned.includes(type)) owned.unshift(type);
  const stats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  return {
    ...raw,
    money: toCount(raw.money, base.money),
    ownedParts: [...new Set(owned)],
    designs: Array.isArray(raw.designs) ? raw.designs.filter((d) => d && typeof d === 'object' && Array.isArray(d.cells)) : [],
    stats: {
      ...stats,
      raids: toCount(stats.raids, 0),
      wins: toCount(stats.wins, 0),
      bestPay: toCount(stats.bestPay, 0),
    },
  };
}

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

export const saveStore = { load, save, getSave, update, resetAll, onChange };
export default saveStore;
