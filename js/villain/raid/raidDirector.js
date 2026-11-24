// 습격 감독 (한 판의 흐름과 박자를 맡음)
// 괴수 값 치르기 → 괴수가 블록으로 쌓여 등장 → 가까운 건물부터 부수기 → 마을이 어느 정도 부서지면 '영웅 출동!' 경보
// → 마을의 영웅이 하늘에서 내려와 맞대결 → (괴수가 터지면) 끝: 진 판  /  (영웅이 터지면) 남은 마을 마저 부수기 → 끝: 이긴 판.
// 싸움은 전부 저절로 흘러갑니다. 이 모듈은 '누가 누구를 노릴지' 와 '언제 다음 장면으로 넘어갈지' 만 정합니다.
//
//   const raid = createRaid({ stage, town, events, debris, fx, makeMonster, makeHero, saveStore, prepareTown?, costOf? })
//       town: 마을 (town.js) 또는 () => 지금 마을 (마을이 바뀌는 경우)
//       makeMonster(design, { hpMul, dmgMul, partDmgMul, smashMul }) → 괴수 (monster.js)
//       makeHero(kind, { hpMul }) → 영웅 (hero.js),  prepareTown(townDef) → 그 마을로 바꿔 지음 (gameWorld 가 줌)
//       costOf(design) → 기본 출동 값 (주면 이것 × 소굴 출동 값 배율, 안 주면 소굴 효과의 raidCost)
//   raid.start(design, { town, mods }?) → { ok, message?, cost }   돈이 모자라면 ok: false (아무 일도 안 일어남)
//       town: 마을 id 또는 마을 설정 (안 주면 'village'),  mods: 소굴 효과 (lair/modifiers.js 의 computeModifiers, 안 주면 효과 없음)
//   raid.update(dt)                    매 장면. 괴수·영웅의 update 도 여기서 부릅니다. (마을·잔해·효과·카메라는 바깥에서)
//   raid.state  { phase, time, earned, destroyedRatio, cost, alertLeft, cleanupLeft, finishing, outcome,
//                 townId, heroKind, heroName, heroAt, payPerBlock }
//       phase: 'idle' | 'building' | 'smashing' | 'alert' | 'duel' | 'cleanup' | 'ended'
//       heroAt: 마을이 이만큼(0~1) 부서지면 영웅 출동 (정보판의 영웅 표시 자리)
//   raid.result   끝난 뒤 (raidResult.js 의 buildResult): { win, earned, destroyedPercent, time, bonuses, cost, aborted, heroLeft,
//                 townId, heroKind, heroName, notoriety, blocksBroken, heroBeaten }
//       저장: 끝날 때 돈·stats(raids, wins, bestPay)만 넣음. 악명·마을별 승리 등은 게임 본체가 goalTracker.recordRaid 로
//   raid.plan / raid.monster / raid.hero / raid.target / raid.design
//   raid.abort()  그만두기 (그때까지 번 돈은 받음. 영웅을 이미 이겼으면 이긴 판, 아니면 진 판)
//   raid.clear()  괴수·영웅을 치우고 'idle' 로 (마을·잔해 되돌리기는 바깥에서) ; raid.dispose()
//
// 보내는 소식: moneyChanged { money, delta }, heroAlert { position, seconds, kind, name }, raidEnded { result },
//            raidPhase { phase, previous }, raidStarted { design, cost, town, heroKind, heroName, heroPay, payPerBlock }
// 듣는 소식: blocksBroken (건물 블록 → 돈), heroArrived, monsterPopped, heroPopped
// 돈·영웅 등장 시점 같은 게임 숫자는 villainConfig.js, 장면 사이 뜸 들이는 시간은 아래 상수에서 바꿉니다.

import { VILLAIN } from '../villainConfig.js';
import { heroStats } from '../hero/hero.js';
import { pickLandingSpot, pickBuilding, gapBetween } from './raidTargets.js';
import { planRaid } from './raidRules.js';
import { buildResult, saveResult } from './raidResult.js';
import { createRaidCamera, RAID_ZOOM } from './raidCamera.js';

const HERO_NEAR = 10; // 영웅이 이만큼 가까우면 괴수가 영웅과 싸움 (칸, 영웅 숫자 engage 가 있으면 그것)
const HERO_FAR_EXTRA = 4; // 싸우다가 영웅이 (가까움 + 이만큼) 멀어지면 다시 건물을 부숨
const MAX_STEP = 1 / 30; // 한 번에 계산하는 가장 긴 시간 (초). 이보다 길면 나눠서 계산
const MAX_STEPS = 8; // 한 장면에 나눠 계산하는 최대 횟수
const ARRIVE_WAIT = 2.5; // 영웅이 내려오기 시작한 뒤 이 시간이 지나면 도착 소식이 없어도 맞대결로 넘어감
const STUCK_SECONDS = 4; // 이 시간 동안 아무것도 못 부수고 제자리면 다른 건물을 노림
const STUCK_MOVE = 1.5; // 이만큼(칸)은 움직여야 '가고 있다' 로 침
const AVOID_SECONDS = 6; // 막혔던 건물은 이 시간 동안 다시 안 노림
const COLLAPSE_HOLD = 2.2; // 남은 건물이 와르르 무너진 뒤 결과가 뜰 때까지
const LOSE_HOLD = 2.0; // 괴수가 터진 뒤 결과가 뜰 때까지
const CLEAR_HOLD = 1.6; // 마을을 다 부순 뒤 결과가 뜰 때까지
const ABORT_HOLD = 0; // 그만두기를 누르면 바로 끝

export function createRaid({ stage = null, town: townOption, events, makeMonster, makeHero, saveStore, prepareTown = null, costOf = null, fx = null } = {}) {
  const bus = events || { emit() {}, on: () => () => {} };
  const view = stage?.view || null;
  const town = () => (typeof townOption === 'function' ? townOption() : townOption);
  const aimCamera = createRaidCamera(view);

  const state = {
    phase: 'idle', time: 0, earned: 0, destroyedRatio: 0, cost: 0, alertLeft: 0, cleanupLeft: 0, finishing: false, outcome: null,
    townId: null, heroKind: 'knight', heroName: VILLAIN.hero.name, heroAt: VILLAIN.hero.appearAtDestroyed, payPerBlock: VILLAIN.town.payPerBlock,
  };
  let result = null;
  let plan = null;
  let heroConfig = VILLAIN.hero;
  let design = null;
  let monster = null;
  let hero = null;
  let heroArrived = false;
  let heroEntered = false;
  let landing = null; // 영웅이 내려올 자리
  let telegraph = null;
  let arriveTimer = 0;
  let smashTime = 0; // 부수기 시작한 뒤 흐른 시간
  let target = null; // 괴수가 지금 노리는 것
  let paidBlocks = 0; // 돈을 받은 건물 블록 수
  let collapsing = false; // 마지막 와르르 중 (이때 무너지는 블록은 돈이 안 됨)
  let cleared = false; // 괴수가 제 힘으로 마을을 다 부숨
  let holdTimer = 0;
  let pending = null; // 끝나기를 기다리는 결과 { win, aborted }
  const stuck = { timer: 0, mark: -1, x: 0, z: 0 };
  const avoid = new Map(); // 건물 → 다시 노려도 되는 시각

  const offs = [
    bus.on('blocksBroken', ({ count = 0, source } = {}) => {
      if (source !== 'building' || collapsing || !isRunning()) return;
      paidBlocks += count;
      state.earned = Math.round(paidBlocks * (plan?.payPerBlock ?? VILLAIN.town.payPerBlock));
    }),
    bus.on('heroArrived', () => {
      if (heroEntered) heroArrived = true;
    }),
  ];

  const isRunning = () => state.phase !== 'idle' && state.phase !== 'ended';

  function setPhase(next) {
    if (state.phase === next) return;
    const previous = state.phase;
    state.phase = next;
    bus.emit('raidPhase', { phase: next, previous });
  }

  // ── 시작 ──
  function start(nextDesign, options = {}) {
    if (!nextDesign) return { ok: false, message: '출동할 괴수를 골라 주세요', cost: 0 };
    const nextPlan = planRaid(nextDesign, options || {}, costOf);
    const cost = nextPlan.cost;
    const money = saveStore?.getSave?.().money ?? Infinity;
    if (money < cost) return { ok: false, message: `돈이 모자라요 (${cost}원 필요)`, cost };
    clear();
    prepareTown?.(nextPlan.town);
    if (saveStore && cost > 0) {
      const saved = saveStore.update((save) => {
        save.money -= cost;
      });
      bus.emit('moneyChanged', { money: saved.money, delta: -cost });
    }
    plan = nextPlan;
    heroConfig = heroStats(plan.heroKind);
    design = nextDesign;
    Object.assign(state, {
      time: 0, earned: 0, destroyedRatio: town().destroyedRatio, cost, alertLeft: 0, cleanupLeft: 0, finishing: false, outcome: null,
      townId: plan.town.id, heroKind: plan.heroKind, heroName: heroConfig.name, heroAt: plan.heroAt, payPerBlock: plan.payPerBlock,
    });
    result = null;
    monster = makeMonster(design, { ...plan.monster });
    monster.setTargets?.(() => foes());
    town().setThreat?.(() => (monster && monster.alive && monster.isBuilt ? monster.position : null));
    monster.build();
    setPhase('building');
    bus.emit('raidStarted', { design, cost, town: plan.town, heroKind: plan.heroKind, heroName: heroConfig.name, heroPay: Math.round((heroConfig.payForWin || 0) * plan.payMul), payPerBlock: plan.payPerBlock });
    view?.setFocus(monster.position, RAID_ZOOM.building);
    view?.snap();
    return { ok: true, cost };
  }

  // 괴수가 때릴 수 있는 것들 (불·돌진이 주변 것도 같이 때릴 때 씀)
  function foes() {
    const list = town().buildings.filter((b) => b.alive);
    if (hero && heroArrived && hero.alive) list.push(hero);
    return list;
  }

  // ── 매 장면 ──
  // 2배속·느린 휴대폰처럼 한 번에 긴 시간이 들어오면 잘게 나눠서 계산 (빠르기에 따라 싸움 결과가 달라지지 않게)
  function update(dt) {
    if (!(dt > 0)) return;
    const steps = Math.min(MAX_STEPS, Math.ceil(dt / MAX_STEP - 1e-6));
    for (let i = 0; i < steps; i++) tick(dt / steps);
  }

  function tick(dt) {
    if (!isRunning()) return;
    const t = town();
    state.time += dt;
    monster?.update(dt);
    hero?.update(dt);
    state.destroyedRatio = t.destroyedRatio; // 마지막 와르르 때는 100% 까지 차오름 (돈은 제 힘으로 부순 만큼만)

    if (pending) {
      holdTimer -= dt;
      camera();
      if (holdTimer <= 0) finish();
      return;
    }

    switch (state.phase) {
      case 'building':
        if (monster.isBuilt) {
          setPhase('smashing');
          resetStuck();
        }
        break;
      case 'smashing':
        direct(dt);
        smashTime += dt;
        if (t.destroyedRatio >= plan.heroAt || smashTime >= plan.heroLatest || t.aliveCount === 0 || !t.nearestAlive(monster.position)) startAlert();
        break;
      case 'alert':
        direct(dt);
        updateAlert(dt);
        break;
      case 'duel':
        if (!monster.alive) return hold({ win: false }, LOSE_HOLD);
        if (!hero.alive) {
          startCleanup();
          break;
        }
        direct(dt);
        break;
      case 'cleanup':
        updateCleanup(dt);
        break;
      default:
        break;
    }
    if (!monster.alive && !pending && isRunning()) hold({ win: false }, LOSE_HOLD); // 어느 장면에서든 괴수가 터지면 끝
    camera();
  }

  // ── 괴수에게 노릴 상대 정해 주기 ──
  function direct(dt) {
    if (!monster.alive || !monster.isBuilt) return;
    const t = town();
    const heroLive = hero && heroArrived && hero.alive;
    const heroGap = heroLive ? gapBetween(monster, hero) : Infinity;
    const near = hero?.engage ?? HERO_NEAR;
    const fightingHero = target === hero && heroLive;
    const anyBuilding = t.buildings.some((b) => b.alive);
    let next = target;

    if (heroLive && (heroGap <= near || (fightingHero && heroGap <= near + HERO_FAR_EXTRA) || !anyBuilding)) next = hero;
    else if (!target || !target.alive || target === hero) next = pickBuilding(t, monster.position, avoid, state.time);

    // 막힘 방지: 한참 동안 부순 것도 없고 움직이지도 않았으면 다른 건물로
    const mark = paidBlocks + (heroLive ? hero.hp ?? 0 : 0) * 1000;
    const moved = Math.hypot(monster.position.x - stuck.x, monster.position.z - stuck.z);
    if (mark !== stuck.mark || moved > STUCK_MOVE || next !== target) resetStuck(mark);
    else {
      stuck.timer += dt;
      if (stuck.timer >= STUCK_SECONDS) {
        if (target && target !== hero) avoid.set(target, state.time + AVOID_SECONDS);
        next = pickBuilding(t, monster.position, avoid, state.time) || (heroLive ? hero : null);
        resetStuck(mark);
      }
    }
    if (next !== target) {
      target = next;
      monster.command(target);
    }
  }

  function resetStuck(mark = stuck.mark) {
    stuck.timer = 0;
    stuck.mark = mark;
    stuck.x = monster ? monster.position.x : 0;
    stuck.z = monster ? monster.position.z : 0;
  }

  // ── 영웅 출동 경보 → 등장 ──
  function startAlert() {
    setPhase('alert');
    state.alertLeft = heroConfig.alertSeconds;
    landing = pickLandingSpot(town(), monster.position);
    telegraph = fx?.telegraph?.(landing, 4.5, heroConfig.alertSeconds) || null;
    bus.emit('heroAlert', { position: landing.clone(), seconds: heroConfig.alertSeconds, kind: plan.heroKind, name: heroConfig.name });
  }

  function updateAlert(dt) {
    if (!heroEntered) {
      state.alertLeft = Math.max(0, state.alertLeft - dt);
      if (state.alertLeft > 0) return;
      hero = makeHero(plan.heroKind, { hpMul: plan.mods.heroHpMul });
      heroEntered = true;
      arriveTimer = ARRIVE_WAIT;
      hero.setTarget?.(monster);
      hero.enter(landing.clone());
      return;
    }
    arriveTimer -= dt;
    if (heroArrived || arriveTimer <= 0) {
      heroArrived = true;
      telegraph = null;
      setPhase('duel');
      resetStuck();
    }
  }

  // ── 영웅을 이긴 뒤: 남은 마을 부수기 ──
  function startCleanup() {
    setPhase('cleanup');
    state.cleanupLeft = VILLAIN.raid?.cleanupSeconds ?? 20;
    target = null;
    resetStuck();
  }

  function updateCleanup(dt) {
    const t = town();
    if (collapsing) {
      if (t.aliveCount === 0) hold({ win: true }, COLLAPSE_HOLD);
      return;
    }
    if (t.aliveCount === 0) {
      cleared = true;
      return hold({ win: true }, CLEAR_HOLD);
    }
    state.cleanupLeft = Math.max(0, state.cleanupLeft - dt);
    if (state.cleanupLeft <= 0) {
      // 시간 끝: 남은 건물은 구경거리로 한꺼번에 와르르 (돈은 안 됨)
      collapsing = true;
      monster.command(null);
      target = null;
      if (t.collapseAll) t.collapseAll();
      else for (const b of t.buildings) if (b.alive) b.collapse?.();
      return;
    }
    direct(dt);
  }

  // ── 끝내기 ──
  function hold(outcome, seconds) {
    if (pending) return;
    pending = outcome;
    holdTimer = seconds;
    state.finishing = true;
    state.outcome = outcome.win ? 'win' : 'lose';
    telegraph?.cancel?.();
    telegraph = null;
    if (monster?.alive) monster.command(null);
    hero?.setTarget?.(outcome.win || !hero.alive ? null : monster);
    if (seconds <= 0) finish();
  }

  function finish() {
    const { win, aborted = false } = pending;
    pending = null;
    const heroLeft = hero && hero.maxHp > 0 ? Math.max(0, Math.min(1, (hero.hp ?? 0) / hero.maxHp)) : 1;
    result = buildResult({
      win, aborted, cleared, paidBlocks, plan, heroLeft,
      time: state.time, ratio: town().destroyedRatio, heroName: heroConfig.name, heroPay: heroConfig.payForWin || 0, designId: design?.id ?? null,
    });
    state.earned = result.earned;
    state.finishing = false;
    state.outcome = win ? 'win' : 'lose';
    const saved = saveResult(saveStore, result);
    if (saved) bus.emit('moneyChanged', { money: saved.money, delta: result.earned });
    setPhase('ended');
    if (monster) view?.setFocus(monster.position, RAID_ZOOM.finale);
    else view?.setFocus(null);
    bus.emit('raidEnded', { result });
  }

  function camera() {
    // (C) 직접 조종 중에는 괴수(와 놀이하는 사람이 고른 것)를 봄
    aimCamera({ phase: state.phase, monster, hero, target: monster?.manual ? monster.aim : target, landing, pending, collapsing });
  }

  // ── 치우기 ──
  function clear() {
    telegraph?.cancel?.();
    telegraph = null;
    monster?.dispose?.();
    hero?.dispose?.();
    town()?.setThreat?.(null);
    monster = null;
    hero = null;
    design = null;
    target = null;
    landing = null;
    heroArrived = false;
    heroEntered = false;
    smashTime = 0;
    paidBlocks = 0;
    collapsing = false;
    cleared = false;
    pending = null;
    holdTimer = 0;
    avoid.clear();
    Object.assign(state, { time: 0, earned: 0, destroyedRatio: 0, cost: 0, alertLeft: 0, cleanupLeft: 0, finishing: false, outcome: null });
    setPhase('idle');
    view?.setFocus(null);
  }

  return {
    state,
    start,
    update,
    clear,
    abort() {
      if (!isRunning()) return;
      // 영웅을 이미 물리친 뒤라면 그만둬도 이긴 판 (영웅 격파 돈도 받음)
      const heroBeaten = state.phase === 'cleanup' || pending?.win === true;
      pending = null;
      hold({ win: heroBeaten, aborted: !heroBeaten }, ABORT_HOLD);
    },
    dispose() {
      clear();
      for (const off of offs) off();
    },
    get result() {
      return result;
    },
    get plan() {
      return plan;
    },
    get monster() {
      return monster;
    },
    get hero() {
      return hero;
    },
    get target() {
      return target;
    },
    get design() {
      return design;
    },
  };
}
