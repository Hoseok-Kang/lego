// 습격 감독 (한 판의 흐름과 박자를 맡음)
// 괴수 값 치르기 → 괴수가 블록으로 쌓여 등장 → 가까운 건물부터 부수기 → 마을이 어느 정도 부서지면 '영웅 출동!' 경보
// → 영웅이 하늘에서 내려와 맞대결 → (괴수가 터지면) 끝: 진 판  /  (영웅이 터지면) 남은 마을 마저 부수기 → 끝: 이긴 판.
// 싸움은 전부 저절로 흘러갑니다. 이 모듈은 '누가 누구를 노릴지' 와 '언제 다음 장면으로 넘어갈지' 만 정합니다.
//
//   const raid = createRaid({ stage, town, events, debris, fx, makeMonster, makeHero, saveStore, costOf? })
//       makeMonster(design) → 괴수 (monster.js),  makeHero() → 영웅 (hero.js),  costOf(design) → 출동 값 (안 주면 도감 계산)
//   raid.start(design) → { ok, message?, cost }   돈이 모자라면 ok: false (아무 일도 안 일어남)
//   raid.update(dt)                    매 장면. 괴수·영웅의 update 도 여기서 부릅니다. (마을·잔해·효과·카메라는 바깥에서)
//   raid.state                         { phase, time, earned, destroyedRatio, cost, alertLeft, cleanupLeft, finishing, outcome }
//       phase: 'idle' | 'building' | 'smashing' | 'alert' | 'duel' | 'cleanup' | 'ended'
//   raid.result                        끝난 뒤 { win, earned, destroyedPercent, time, bonuses:[{ id, label, amount }], cost, aborted }
//   raid.monster / raid.hero           지금 판의 괴수 / 영웅 (없으면 null) — 체력 막대에 씀
//   raid.abort()                       그만두기 (그때까지 번 돈은 받음, 진 판으로 끝남)
//   raid.clear()                       괴수·영웅을 치우고 'idle' 로 (마을·잔해 되돌리기는 바깥에서 town.reset() 등)
//   raid.dispose()
//
// 보내는 소식: moneyChanged { money, delta }, heroAlert { position, seconds }, raidEnded { result },
//            raidPhase { phase, previous }, raidStarted { design, cost }
// 듣는 소식: blocksBroken (건물 블록 → 돈), heroArrived, monsterPopped, heroPopped
//
// 돈·영웅 등장 시점(hero.appearAtDestroyed, hero.appearLatestSeconds)·마무리 시간(raid.cleanupSeconds) 같은 게임 숫자는 villainConfig.js, 장면 사이 뜸 들이는 시간·카메라 다가가기는 아래 상수에서 바꿉니다.

import { VILLAIN } from '../villainConfig.js';
import { designCost } from '../data/bestiary.js';
import { pickLandingSpot, pickBuilding, gapBetween } from './raidTargets.js';

const HERO_NEAR = 10; // 영웅이 이만큼 가까우면 괴수가 영웅과 싸움 (칸)
const HERO_FAR = 14; // 싸우다가 영웅이 이만큼 멀어지면 다시 건물을 부숨
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
// 카메라가 다가가는 정도 (1 = 마을 전체가 보임)
const ZOOM = { building: 1.9, smashing: 1.3, alert: 1.2, duel: 1.45, cleanup: 1.25, finale: 1 };

export function createRaid({ stage = null, town, events, debris = null, fx = null, makeMonster, makeHero, saveStore, costOf = designCost } = {}) {
  const bus = events || { emit() {}, on: () => () => {} };
  const view = stage?.view || null;
  const heroConfig = VILLAIN.hero;

  const state = { phase: 'idle', time: 0, earned: 0, destroyedRatio: 0, cost: 0, alertLeft: 0, cleanupLeft: 0, finishing: false, outcome: null };
  let result = null;
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
  let frozenRatio = null; // 와르르 직전의 부서진 비율 (결과에 씀)
  let holdTimer = 0;
  let pending = null; // 끝나기를 기다리는 결과 { win, aborted }
  const stuck = { timer: 0, mark: -1, x: 0, z: 0 };
  const avoid = new Map(); // 건물 → 다시 노려도 되는 시각

  const offs = [
    bus.on('blocksBroken', ({ count = 0, source } = {}) => {
      if (source !== 'building' || collapsing || !isRunning()) return;
      paidBlocks += count;
      state.earned = Math.round(paidBlocks * VILLAIN.town.payPerBlock);
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
  function start(nextDesign) {
    if (!nextDesign) return { ok: false, message: '출동할 괴수를 골라 주세요', cost: 0 };
    const cost = Math.max(0, Math.round(costOf(nextDesign) || 0));
    const money = saveStore?.getSave?.().money ?? Infinity;
    if (money < cost) return { ok: false, message: `돈이 모자라요 (${cost}원 필요)`, cost };
    clear();
    if (saveStore && cost > 0) {
      const saved = saveStore.update((save) => {
        save.money -= cost;
      });
      bus.emit('moneyChanged', { money: saved.money, delta: -cost });
    }
    design = nextDesign;
    Object.assign(state, { time: 0, earned: 0, destroyedRatio: town.destroyedRatio, cost, alertLeft: 0, cleanupLeft: 0, finishing: false, outcome: null });
    result = null;
    monster = makeMonster(design);
    monster.setTargets?.(() => foes());
    town.setThreat?.(() => (monster && monster.alive && monster.isBuilt ? monster.position : null));
    monster.build();
    setPhase('building');
    bus.emit('raidStarted', { design, cost });
    view?.setFocus(monster.position, ZOOM.building);
    view?.snap();
    return { ok: true, cost };
  }

  // 괴수가 때릴 수 있는 것들 (불·돌진이 주변 것도 같이 때릴 때 씀)
  function foes() {
    const list = town.buildings.filter((b) => b.alive);
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
    state.time += dt;
    monster?.update(dt);
    hero?.update(dt);
    if (!collapsing) state.destroyedRatio = town.destroyedRatio;

    if (pending) {
      holdTimer -= dt;
      aimCamera();
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
        if (town.destroyedRatio >= heroConfig.appearAtDestroyed || smashTime >= (heroConfig.appearLatestSeconds ?? 36) || town.aliveCount === 0 || !town.nearestAlive(monster.position)) startAlert();
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
    aimCamera();
  }

  // ── 괴수에게 노릴 상대 정해 주기 ──
  function direct(dt) {
    if (!monster.alive || !monster.isBuilt) return;
    const heroLive = hero && heroArrived && hero.alive;
    const heroGap = heroLive ? gapBetween(monster, hero) : Infinity;
    const fightingHero = target === hero && heroLive;
    const anyBuilding = town.buildings.some((b) => b.alive);
    let next = target;

    if (heroLive && (heroGap <= HERO_NEAR || (fightingHero && heroGap <= HERO_FAR) || !anyBuilding)) next = hero;
    else if (!target || !target.alive || target === hero) next = pickBuilding(town, monster.position, avoid, state.time);

    // 막힘 방지: 한참 동안 부순 것도 없고 움직이지도 않았으면 다른 건물로
    const mark = paidBlocks + (heroLive ? hero.hp ?? 0 : 0) * 1000;
    const moved = Math.hypot(monster.position.x - stuck.x, monster.position.z - stuck.z);
    if (mark !== stuck.mark || moved > STUCK_MOVE || next !== target) resetStuck(mark);
    else {
      stuck.timer += dt;
      if (stuck.timer >= STUCK_SECONDS) {
        if (target && target !== hero) avoid.set(target, state.time + AVOID_SECONDS);
        next = pickBuilding(town, monster.position, avoid, state.time) || (heroLive ? hero : null);
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
    landing = pickLandingSpot(town, monster.position);
    telegraph = fx?.telegraph?.(landing, 4.5, heroConfig.alertSeconds) || null;
    bus.emit('heroAlert', { position: landing.clone(), seconds: heroConfig.alertSeconds });
  }

  function updateAlert(dt) {
    if (!heroEntered) {
      state.alertLeft = Math.max(0, state.alertLeft - dt);
      if (state.alertLeft > 0) return;
      hero = makeHero();
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
    if (collapsing) {
      if (town.aliveCount === 0) hold({ win: true }, COLLAPSE_HOLD);
      return;
    }
    if (town.aliveCount === 0) {
      cleared = true;
      return hold({ win: true }, CLEAR_HOLD);
    }
    state.cleanupLeft = Math.max(0, state.cleanupLeft - dt);
    if (state.cleanupLeft <= 0) {
      // 시간 끝: 남은 건물은 구경거리로 한꺼번에 와르르 (돈은 안 됨)
      frozenRatio = town.destroyedRatio;
      collapsing = true;
      monster.command(null);
      target = null;
      if (town.collapseAll) town.collapseAll();
      else for (const b of town.buildings) if (b.alive) b.collapse?.();
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
    const ratio = frozenRatio ?? town.destroyedRatio;
    const bonuses = [];
    const blockPay = Math.round(paidBlocks * VILLAIN.town.payPerBlock);
    bonuses.push({ id: 'blocks', label: `부순 블록 ${paidBlocks}개`, amount: blockPay });
    if (win) {
      bonuses.push({ id: 'hero', label: `${heroConfig.name} 격파`, amount: heroConfig.payForWin });
      if (cleared) bonuses.push({ id: 'clear', label: '마을 싹쓸이', amount: VILLAIN.town.clearBonus });
    }
    let earned = bonuses.reduce((sum, b) => sum + b.amount, 0);
    if (earned < VILLAIN.economy.minPay) {
      bonuses.push({ id: 'minPay', label: '수고비', amount: VILLAIN.economy.minPay - earned });
      earned = VILLAIN.economy.minPay;
    }
    result = {
      win,
      aborted,
      earned,
      cost: state.cost,
      destroyedPercent: Math.round(ratio * 100),
      time: Math.round(state.time * 10) / 10,
      bonuses,
      designId: design?.id ?? null,
    };
    state.earned = earned;
    state.finishing = false;
    state.outcome = win ? 'win' : 'lose';
    if (saveStore) {
      const saved = saveStore.update((save) => {
        save.money += earned;
        save.stats.raids += 1;
        if (win) save.stats.wins += 1;
        save.stats.bestPay = Math.max(save.stats.bestPay || 0, earned);
      });
      bus.emit('moneyChanged', { money: saved.money, delta: earned });
    }
    setPhase('ended');
    if (monster) view?.setFocus(monster.position, ZOOM.finale);
    else view?.setFocus(null);
    bus.emit('raidEnded', { result });
  }

  // ── 카메라가 볼 곳 ──
  const focus = { x: 0, z: 0 };
  function aimCamera() {
    if (!view || !monster) return;
    const m = monster.position;
    if (collapsing || state.phase === 'ended') return view.setFocus(m, ZOOM.finale); // 마을 전체 (세로 화면은 괴수 쪽을 가까이)
    if (pending) {
      const at = pending.win ? m : hero?.alive ? mid(m, hero.position, 0.5) : m;
      return view.setFocus(at, ZOOM.cleanup);
    }
    switch (state.phase) {
      case 'building':
        return view.setFocus(m, ZOOM.building);
      case 'alert':
        return view.setFocus(landing ? mid(m, landing, 0.5) : m, ZOOM.alert);
      case 'duel': {
        if (!hero) return view.setFocus(m, ZOOM.duel);
        const gap = Math.hypot(hero.position.x - m.x, hero.position.z - m.z);
        return view.setFocus(mid(m, hero.position, 0.5), Math.max(1.1, ZOOM.duel - Math.max(0, gap - 12) * 0.03));
      }
      case 'cleanup':
        return view.setFocus(target ? mid(m, target.position, 0.35) : m, ZOOM.cleanup);
      default:
        return view.setFocus(target ? mid(m, target.position, 0.35) : m, ZOOM.smashing);
    }
  }
  function mid(a, b, t) {
    focus.x = a.x + (b.x - a.x) * t;
    focus.z = a.z + (b.z - a.z) * t;
    return focus;
  }

  // ── 치우기 ──
  function clear() {
    telegraph?.cancel?.();
    telegraph = null;
    monster?.dispose?.();
    hero?.dispose?.();
    town.setThreat?.(null);
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
    frozenRatio = null;
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
      pending = null;
      hold({ win: false, aborted: true }, ABORT_HOLD);
    },
    dispose() {
      clear();
      for (const off of offs) off();
    },
    get result() {
      return result;
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
