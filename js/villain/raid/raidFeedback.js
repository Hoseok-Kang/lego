// 습격 손맛 (떠오르는 글자, 화면 흔들림, 맞는 순간 살짝 멈춤)
// 소식(events)을 듣고 저절로 반응합니다: 건물 블록이 부서지면 '+돈', 건물이 무너지면 '와르르!', 영웅이 오면 '영웅 출동!',
// 누가 터지면 '펑!'. 센 타격일수록 화면이 더 흔들리고 아주 잠깐 시간이 느려집니다.
// 영웅마다: 얼음에 맞아 느려지면 '꽁꽁!', 마법사가 사라지면 '휙!', 수호자가 방패로 막으면 '막았다!', 방패가 깨지면 '방패 깨짐!'.
// '+돈' 과 영웅 이름·격파 돈은 raidStarted 소식(이번 판 마을·영웅·수입 배율)을 따릅니다.
// 실제 시계를 쓰지 않고 update(dt) 로만 움직이므로, 한 장면씩 넘기며 찍어도 똑같이 나옵니다.
//
//   const feedback = createRaidFeedback({ events, view, layer })
//       view: 마을 카메라 (stage.view),  layer: 글자를 띄울 화면 위 상자 (안 주면 글자 없이 흔들림만)
//       alertText: false 면 '영웅 출동!' 글자를 안 띄움 (정보판의 사이렌 띠가 대신 알릴 때)
//   feedback.scale(dt) → 이번 장면에 게임을 움직일 시간 (맞는 순간에는 아주 작아짐). 괴수·마을·잔해 update 에는 이 값을 넘기세요
//   feedback.update(dt)                 매 장면 (진짜 dt). 글자를 옮기고 멈춤 시간을 줄임
//   feedback.float(위치, 글, { kind, lift })   글자 하나 띄우기. kind: 'money' | 'boom' | 'alert' | 'good' | 'bad'
//   feedback.timeScale                  지금 시간 배율 (1 = 보통)
//   feedback.clear() ; feedback.dispose()
//
// 글자 크기·색, 흔들림 세기, 멈춤 길이는 아래 상수에서 바꿉니다. (글씨체는 페이지의 Jua 를 씀)

import * as THREE from '../../lib/three.js';
import { VILLAIN } from '../villainConfig.js';

const MONEY_GAP = 0.32; // '+돈' 글자를 모아서 띄우는 간격 (초)
const FLOAT_SECONDS = 1.15; // 글자가 떠 있는 시간
const FLOAT_RISE = 46; // 글자가 떠오르는 높이 (px)
const MAX_FLOATS = 22; // 한 번에 떠 있을 수 있는 글자 수
const STOP_SCALE = 0.06; // 멈춤 동안의 시간 배율
const STOP = { big: 0.07, building: 0.09, pop: 0.16, arrive: 0.12 }; // 멈춤 길이 (초)
const SHAKE = { hitMin: 0.03, hitPer: 0.006, hitMax: 0.28, building: 0.5, pop: 1, arrive: 0.8, step: 0.035 };
const BIG_HIT = 28; // 이 피해 이상이면 '센 타격' (잠깐 멈춤)
const NOTE_GAP = 0.7; // '막았다!' '꽁꽁!' 같은 같은 글자를 다시 띄우기까지 (초)
const TEXT = { slowed: '꽁꽁!', blink: '휙!', blocked: '막았다!', shieldBroken: '방패 깨짐!', partLost: '부품이 떨어졌어요!', crash: '와르르!', boom: '펑!', alert: '영웅 출동!' };

const STYLE_ID = 'villain-float-style';
const CSS = `
.villain-floats{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:5}
.villain-float{position:absolute;left:0;top:0;white-space:nowrap;font-family:'Jua','IBM Plex Sans KR',sans-serif;
  font-size:clamp(17px,2.6vmin + 9px,30px);line-height:1;color:#fff;will-change:transform,opacity;
  font-weight:700;text-shadow:-2px -2px 0 #1B2A34,2px -2px 0 #1B2A34,-2px 2px 0 #1B2A34,2px 2px 0 #1B2A34,0 -2.5px 0 #1B2A34,0 2.5px 0 #1B2A34,
  -2.5px 0 0 #1B2A34,2.5px 0 0 #1B2A34,0 5px 0 rgba(27,42,52,.6)}
.villain-float.money{color:#F2CD37}
.villain-float.boom{color:#FF698F;font-size:clamp(30px,5.5vmin + 12px,64px)}
.villain-float.alert{color:#FE8A18;font-size:clamp(24px,4vmin + 10px,46px)}
.villain-float.good{color:#BBE90B;font-size:clamp(22px,3.4vmin + 10px,40px)}
.villain-float.bad{color:#9FC3E9;font-size:clamp(20px,3vmin + 10px,34px)}
`;

export function createRaidFeedback({ events, view = null, layer = null, alertText = true } = {}) {
  const bus = events || { on: () => () => {} };
  let root = null;
  if (layer && typeof document !== 'undefined') {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    root = document.createElement('div');
    root.className = 'villain-floats';
    root.setAttribute('aria-hidden', 'true');
    layer.appendChild(root);
  }

  const floats = []; // { el, anchor, age, life, lift, pop, drift }
  const pool = [];
  let stopLeft = 0;
  let money = { amount: 0, timer: 0, position: new THREE.Vector3(), has: false };
  let floatCount = 0;
  const lifted = new THREE.Vector3();
  let payPerBlock = VILLAIN.town.payPerBlock; // 이번 판 블록당 돈 (raidStarted 로 바뀜)
  let heroPay = VILLAIN.hero.payForWin;
  let heroName = VILLAIN.hero.name;
  const noteAt = new Map(); // 글자 → 다시 띄울 수 있는 시각
  let clock = 0;
  function note(key, position, kind, lift) {
    if ((noteAt.get(key) ?? -1) > clock || !position) return;
    noteAt.set(key, clock + NOTE_GAP);
    float(position, TEXT[key], { kind, lift });
  }

  function float(position, text, { kind = '', lift = 3, life = FLOAT_SECONDS } = {}) {
    if (!root || !position) return;
    if (floats.length >= MAX_FLOATS) release(floats.shift());
    const el = pool.pop() || document.createElement('div');
    el.className = `villain-float ${kind}`;
    el.textContent = text;
    root.appendChild(el);
    floatCount++;
    const item = {
      el,
      anchor: new THREE.Vector3(position.x, (position.y || 0) + lift, position.z),
      age: 0,
      life,
      drift: ((floatCount * 37) % 21) - 10, // 글자끼리 겹치지 않게 좌우로 조금씩 (정해진 순서 → 다시 돌려도 같음)
      big: kind === 'boom' || kind === 'alert' || kind === 'good',
    };
    floats.push(item);
    place(item);
  }

  function release(item) {
    if (!item) return;
    item.el.remove();
    pool.push(item.el);
  }

  function place(item) {
    const t = Math.min(1, item.age / item.life);
    const screen = view ? view.worldToScreen(lifted.copy(item.anchor)) : { x: 0, y: 0 };
    const box = root.getBoundingClientRect();
    const rise = (1 - (1 - t) * (1 - t)) * FLOAT_RISE * (item.big ? 1.3 : 1);
    // 뿅 하고 커졌다가 제 크기로, 끝에는 흐려짐
    const pop = t < 0.14 ? 0.4 + (t / 0.14) * 0.85 : t < 0.26 ? 1.25 - ((t - 0.14) / 0.12) * 0.25 : 1;
    const x = screen.x - box.left + item.drift * (item.big ? 0 : 1);
    const y = screen.y - box.top - rise;
    item.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) scale(${pop.toFixed(3)})`;
    item.el.style.opacity = t > 0.72 ? String(Math.max(0, 1 - (t - 0.72) / 0.28).toFixed(3)) : '1';
  }

  function stop(seconds) {
    stopLeft = Math.max(stopLeft, seconds);
  }

  // ── 소식 듣기 ──
  const offs = [
    bus.on('raidStarted', ({ payPerBlock: pay, heroPay: reward, heroName: name } = {}) => {
      if (Number.isFinite(pay)) payPerBlock = pay;
      if (Number.isFinite(reward)) heroPay = reward;
      if (name) heroName = name;
    }),
    bus.on('blocksBroken', ({ count = 0, source, position } = {}) => {
      if (source !== 'building' || !position) return;
      money.amount += count * payPerBlock;
      money.position.copy(position);
      money.has = true;
    }),
    bus.on('hit', ({ amount = 0 } = {}) => {
      view?.shake(Math.min(SHAKE.hitMax, SHAKE.hitMin + amount * SHAKE.hitPer));
      if (amount >= BIG_HIT) stop(STOP.big);
    }),
    bus.on('monsterStep', () => view?.shake(SHAKE.step)),
    bus.on('buildingDestroyed', ({ building } = {}) => {
      view?.shake(SHAKE.building);
      stop(STOP.building);
      if (building) float(building.position, TEXT.crash, { kind: 'good', lift: Math.min(12, (building.height || 6) * 0.6) });
    }),
    bus.on('heroAlert', ({ position } = {}) => {
      if (position && alertText) float(position, TEXT.alert, { kind: 'alert', lift: 7, life: 1.6 });
    }),
    bus.on('heroArrived', ({ hero } = {}) => {
      view?.shake(SHAKE.arrive);
      stop(STOP.arrive);
      if (hero?.position) float(hero.position, `${hero.name || heroName}!`, { kind: 'alert', lift: Math.max(11, (hero.height || 7) + 3), life: 1.4 });
    }),
    bus.on('monsterPopped', ({ monster } = {}) => {
      view?.shake(SHAKE.pop);
      stop(STOP.pop);
      if (monster?.position) float(monster.position, TEXT.boom, { kind: 'boom', lift: Math.min(12, (monster.height || 8) * 0.6), life: 1.5 });
    }),
    bus.on('heroPopped', ({ hero } = {}) => {
      view?.shake(SHAKE.pop);
      stop(STOP.pop);
      if (hero?.position) {
        float(hero.position, TEXT.boom, { kind: 'boom', lift: 6, life: 1.5 });
        float(hero.position, `+${heroPay}`, { kind: 'money', lift: 11, life: 1.6 });
      }
    }),
    bus.on('partLost', ({ position } = {}) => {
      if (position) float(position, TEXT.partLost, { kind: 'bad', lift: 9 });
    }),
    bus.on('heroLanded', ({ kind } = {}) => {
      if (kind === 'slam') view?.shake(SHAKE.arrive); // 수호자의 땅 내려찍기
    }),
    bus.on('monsterSlowed', ({ position, monster } = {}) => note('slowed', position, 'bad', Math.min(12, (monster?.height || 8) * 0.7))),
    bus.on('heroBlink', ({ from } = {}) => note('blink', from, 'bad', 7)),
    bus.on('heroBlocked', ({ position } = {}) => note('blocked', position, 'bad', 4)),
    bus.on('heroShieldBroken', ({ position } = {}) => {
      view?.shake(SHAKE.building);
      stop(STOP.big);
      note('shieldBroken', position, 'good', 12);
    }),
  ];

  function update(dt) {
    clock += dt;
    if (stopLeft > 0) stopLeft = Math.max(0, stopLeft - dt);
    // '+돈' 은 잠깐씩 모아서 한 번에
    money.timer -= dt;
    if (money.has && money.timer <= 0 && Math.round(money.amount) >= 1) {
      // 1원이 안 되면 '+0' 을 띄우지 않고 더 모음
      float(money.position, `+${Math.round(money.amount)}`, { kind: 'money', lift: 5 });
      money.amount = 0;
      money.has = false;
      money.timer = MONEY_GAP;
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const item = floats[i];
      item.age += dt;
      if (item.age >= item.life) {
        release(item);
        floats.splice(i, 1);
      } else place(item);
    }
  }

  function clear() {
    for (const item of floats) release(item);
    floats.length = 0;
    stopLeft = 0;
    money.amount = 0;
    money.has = false;
    money.timer = 0;
    noteAt.clear();
  }

  return {
    float,
    update,
    clear,
    stop,
    scale: (dt) => dt * (stopLeft > 0 ? STOP_SCALE : 1),
    get timeScale() {
      return stopLeft > 0 ? STOP_SCALE : 1;
    },
    get count() {
      return floats.length;
    },
    dispose() {
      clear();
      for (const off of offs) off();
      root?.remove();
    },
  };
}
