// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 소굴 저장 바꾸기 (짓기 · 옮기기 · 강화 · 팔기 · 목표 받기 · 계책 도감 적기)
// 돈 · 악명 단계 · 개수를 검사하고, 소굴 계산(lair/lairSim.js)으로 바꾼 뒤 곧바로 저장합니다.
// 화면 · 3D · 소리는 건드리지 않아요 (그건 lairController.js 가 결과를 보고 합니다).
//
//   const act = createLairActions({ saveStore, gameState, events })
//   act.check(type)          → { ok, reason, price }       지금 지을 수 있는지 (악명 단계 · 개수 · 돈)
//   act.build(type, x, y)    → { ok, reason, id }          돈을 내고 짓기
//   act.move(id, x, y)       → { ok, reason, id, building, moved }   옮기기 (공짜)
//   act.upgrade(id)          → { ok, reason, id, price, building }   돈을 내고 한 단계 강화
//   act.sell(id)             → { ok, reason, refund, building }      팔고 돈 돌려받기 (왕좌는 못 팖)
//   act.claim(key)           → { ok, reason, goal, rankUp }          목표 보상 받기 (rankUp: 그 덕에 단계가 올랐으면 알림 내용)
//   act.markSchemes()        → [처음 켜진 계책 키]                    계책 도감에 적기
//   돈이 바뀌면 events 에 moneyChanged { money, delta } 를 보냅니다.
//
// 이유 글자는 js/villain/gameText.js 의 LAIR_ACTION_TEXT, 시설 값은 data/facilities.js 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { FACILITIES } from './data/facilities.js';
import { RANKS } from './data/ranks.js';
import * as sim from './lair/lairSim.js';
import { claimGoal, markSchemesSeen } from './lair/goalTracker.js';
import { lockText } from './ui/lairKit.js';
import { LAIR_ACTION_TEXT as TEXT } from './gameText.js'; // 화면 알림 글자 (한국어 / 영어)

export function createLairActions({ saveStore, gameState: gs, events = null }) {
  const save = () => saveStore.getSave();

  // 돈을 바꾸고 저장 + 소식
  function commit(fn) {
    const before = save().money;
    const after = saveStore.update(fn);
    if (after.money !== before) events?.emit('moneyChanged', { money: after.money, delta: after.money - before });
    return after;
  }

  function check(type) {
    const def = FACILITIES[type];
    if (!def) return { ok: false, reason: sim.REASONS.unknown };
    const s = save();
    if (gs.rank().rank < def.unlockRank) return { ok: false, reason: lockText(def.unlockRank, RANKS) };
    const max = def.maxCount ?? Infinity;
    if (sim.countOf(s.lair, type) >= max) return { ok: false, reason: max > 1 ? sim.REASONS.tooMany(max) : sim.REASONS.onlyOne };
    const price = def.price[0];
    if (s.money < price) return { ok: false, reason: TEXT.poorBuild(def.name, price - s.money) };
    return { ok: true, price };
  }

  function build(type, x, y) {
    const c = check(type);
    if (!c.ok) return c;
    const placed = sim.place(save().lair, type, x, y);
    if (!placed.ok) return { ok: false, reason: placed.reason };
    commit((s) => {
      s.lair = placed.lair;
      s.money -= c.price;
    });
    return { ok: true, id: placed.id };
  }

  function move(id, x, y) {
    const building = sim.findBuilding(save().lair, id);
    const moved = sim.move(save().lair, id, x, y);
    if (!moved.ok) return { ok: false, reason: moved.reason };
    commit((s) => {
      s.lair = moved.lair;
    });
    return { ok: true, id, building, moved: !!building && (building.x !== x || building.y !== y) };
  }

  function upgrade(id) {
    const s = save();
    const building = sim.findBuilding(s.lair, id);
    const price = sim.upgradePrice(s.lair, id);
    if (!building || price == null) return { ok: false, reason: building ? sim.REASONS.maxLevel : sim.REASONS.missing };
    if (s.money < price) return { ok: false, reason: TEXT.poorUp(price - s.money), poor: true };
    const up = sim.upgrade(s.lair, id);
    if (!up.ok) return { ok: false, reason: up.reason };
    commit((next) => {
      next.lair = up.lair;
      next.money -= up.price;
    });
    return { ok: true, id, price: up.price, building };
  }

  function sell(id) {
    const s = save();
    const building = sim.findBuilding(s.lair, id);
    const removed = sim.remove(s.lair, id);
    if (!building || !removed.ok) return { ok: false, reason: removed.reason };
    commit((next) => {
      next.lair = removed.lair;
      next.money += removed.refund;
    });
    return { ok: true, refund: removed.refund, building };
  }

  function claim(key) {
    const rankBefore = gs.rank().rank;
    let goal = null;
    commit((s) => {
      goal = claimGoal(s, key, { evaluation: gs.evaluation() });
    });
    if (!goal) return { ok: false, reason: TEXT.notYet };
    return { ok: true, goal, rankUp: gs.rankUpInfo(rankBefore, gs.rank().rank) };
  }

  function markSchemes() {
    const ev = gs.evaluation();
    if (!(ev?.schemes ?? []).some((x) => !save().schemesSeen.includes(x.key))) return [];
    let fresh = [];
    saveStore.update((s) => {
      fresh = markSchemesSeen(s, ev);
    });
    return fresh;
  }

  return { check, build, move, upgrade, sell, claim, markSchemes };
}
