// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 목표 진행 세기 (목표 표는 data/goals.js)
// 화면·저장소를 건드리지 않아요. claim·mark·record 는 넘겨준 save 를 고치기만 하니
// saveStore.update((save) => …) 안에서 부르면 저장까지 한 번에 돼요.
//
// 쓰는 법
//   activeGoals(save, ctx)       → 지금 보이는 목표 (최대 3개)
//       [{ key, name, icon, emoji, desc, need, progress, done (끝냈으면 true), reward, rewardText, doneText }]
//   progressOf(goal|key, save, ctx) → 지금까지 센 수 (0 ~ need)
//   completedGoals(save, ctx)    → 보이는 목표 중 다 채운 것 (save 를 안 고침)
//   claimCompleted(save, ctx)    → 다 채운 목표를 모두 받기: goalsDone 에 넣고 보상(돈·악명)을 save 에 더함.
//                                  받은 덕에 새로 열린 목표도 이미 채웠으면 함께 받음 → 받은 목표 [goal]
//   claimGoal(save, key, ctx)    → 그 목표 하나만 받기 (보이고 다 채웠을 때만) → goal 또는 null
//   markSchemesSeen(save, evaluation) → 처음 켜진 계책을 schemesSeen 에 넣고 그 키 목록을 돌려줌 (도감·알림용)
//   recordRaid(save, result, { townId, notoriety }) → 습격 결과를 기록 (악명, 마을별 승리, 영웅 격파, 부순 블록)
//       돈·stats.raids·stats.wins 는 습격 감독(raidDirector)이 이미 넣으니 여기서는 안 건드려요
//   ctx = { evaluation?, lastResult? } — evaluation 이 없으면 save.lair 로 직접 계산해요
// ─────────────────────────────────────────────────────────────

import { GOALS, GOAL_MAP, GOALS_OPEN } from '../data/goals.js';
import { SCHEMES } from '../data/schemes.js';
import { evaluate } from './lairSim.js';

function withEvaluation(save, ctx) {
  if (ctx?.evaluation || !save?.lair) return ctx || {};
  return { ...(ctx || {}), evaluation: evaluate(save.lair) };
}

const doneSet = (save) => new Set(Array.isArray(save?.goalsDone) ? save.goalsDone : []);

function isOpen(goal, done) {
  return !done.has(goal.key) && (goal.after || []).every((k) => done.has(k));
}

export function progressOf(goal, save, ctx) {
  const g = typeof goal === 'string' ? GOAL_MAP[goal] : goal;
  if (!g) return 0;
  let value = 0;
  try {
    value = Number(g.progress(save, withEvaluation(save, ctx))) || 0;
  } catch {
    value = 0;
  }
  return Math.max(0, Math.min(g.need, value));
}

function rewardText(reward) {
  const bits = [];
  if (reward?.money) bits.push(`+${reward.money}원`);
  if (reward?.notoriety) bits.push(`악명 +${reward.notoriety}`);
  return bits.join(' · ');
}

function openGoals(save) {
  const done = doneSet(save);
  const out = [];
  for (const g of GOALS) {
    if (out.length >= GOALS_OPEN) break;
    if (isOpen(g, done)) out.push(g);
  }
  return out;
}

export function activeGoals(save, ctx) {
  const full = withEvaluation(save, ctx);
  return openGoals(save).map((g) => {
    const progress = progressOf(g, save, full);
    return {
      key: g.key,
      name: g.name,
      icon: g.icon,
      emoji: g.emoji,
      desc: g.desc,
      need: g.need,
      progress,
      done: progress >= g.need,
      reward: { ...g.reward },
      rewardText: rewardText(g.reward),
      doneText: g.done,
    };
  });
}

export function completedGoals(save, ctx) {
  const full = withEvaluation(save, ctx);
  return openGoals(save).filter((g) => progressOf(g, save, full) >= g.need);
}

function grant(save, goal) {
  if (!Array.isArray(save.goalsDone)) save.goalsDone = [];
  save.goalsDone.push(goal.key);
  save.money = (Number(save.money) || 0) + (goal.reward?.money || 0);
  save.notoriety = (Number(save.notoriety) || 0) + (goal.reward?.notoriety || 0);
}

export function claimGoal(save, key, ctx) {
  const goal = openGoals(save).find((g) => g.key === key);
  if (!goal || progressOf(goal, save, withEvaluation(save, ctx)) < goal.need) return null;
  grant(save, goal);
  return goal;
}

export function claimCompleted(save, ctx) {
  const full = withEvaluation(save, ctx);
  const claimed = [];
  for (let guard = 0; guard < GOALS.length; guard += 1) {
    const ready = openGoals(save).filter((g) => progressOf(g, save, full) >= g.need);
    if (!ready.length) break;
    for (const g of ready) {
      grant(save, g);
      claimed.push(g);
    }
  }
  return claimed;
}

export function markSchemesSeen(save, evaluation) {
  if (!Array.isArray(save.schemesSeen)) save.schemesSeen = [];
  const fresh = [];
  for (const s of evaluation?.schemes || []) {
    if (!SCHEMES[s.key] || save.schemesSeen.includes(s.key)) continue;
    save.schemesSeen.push(s.key);
    fresh.push(s.key);
  }
  return fresh;
}

export function recordRaid(save, result, { townId = 'village', notoriety = 0 } = {}) {
  save.notoriety = (Number(save.notoriety) || 0) + Math.max(0, Math.round(notoriety));
  if (!save.townWins || typeof save.townWins !== 'object') save.townWins = {};
  if (!save.stats || typeof save.stats !== 'object') save.stats = {};
  if (result?.win) {
    save.townWins[townId] = (Number(save.townWins[townId]) || 0) + 1;
    save.stats.heroesBeaten = (Number(save.stats.heroesBeaten) || 0) + 1;
  }
  const blocks = Number(result?.blocksBroken ?? result?.bonuses?.find?.((b) => b.id === 'blocks')?.count) || 0;
  save.stats.blocksBroken = (Number(save.stats.blocksBroken) || 0) + Math.max(0, Math.round(blocks));
  return save;
}
