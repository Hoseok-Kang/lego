// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 습격 정보판 (마을을 부수는 동안 화면 위에 뜨는 것)
// 번 돈(또르르 올라감), 마을 부서짐 % 막대(영웅이 오는 지점 표시), 괴수 체력, 영웅 체력(나타나면),
// '영웅 출동!' 사이렌 띠, 빠르기 단추(1× / 2×), 그만두기 단추를 보여 줍니다.
// 이 화면은 숫자를 받아 보여 주기만 합니다. 매 장면 update(…) 또는 sync(raid) 를 불러 주세요 (바뀐 것만 다시 그려서 가볍습니다).
//
// 쓰는 법
//   const hud = createRaidHud(root, {
//     onSpeed(배율),        빠르기 단추를 눌렀을 때 (1 → 2 → 1 …)
//     onQuit(),             그만두기 (이 화면이 먼저 "정말요?" 를 물어봄)
//     onPause(true|false),  (없어도 됨) "정말요?" 창이 떠 있는 동안 true → 그동안 게임을 멈추고 싶을 때
//     speeds,               고를 수 있는 빠르기 목록 (기본: villainConfig 의 speedOptions)
//   })
//   hud.show({ name, thumb, heroName, heroKind, heroAt })   습격 시작: 괴수 이름 · 작은 그림 주소, 이번 마을 영웅
//                                   (이름 · 얼굴 종류 'knight'|'iceMage'|'guardian' · 마을이 몇(0~1) 부서지면 오는지). 숫자를 처음으로 되돌림
//   hud.setHero({ heroName, heroKind, heroAt })   습격 중에 영웅 정보만 바꾸기 (raid.start 뒤 raid.state 값으로)
//   hud.update({ earned, destroyedRatio, monsterHp, monsterMaxHp, heroHp, heroMaxHp, heroVisible, phase, cleanupLeft })
//   hud.sync(raid)                  raidDirector 의 raid 를 그대로 넘기면 위 값을 알아서 읽음
//   hud.setSpeed(배율) / hud.speed
//   hud.getInsets() → { top, bottom, left, right }   정보판이 가리는 크기(px). 카메라(stage.view.setInsets)에 넘겨 주세요
//   hud.floatLayer                  떠오르는 글자를 넣을 상자 (raidFeedback 의 layer 로 쓰기 좋음)
//   hud.hide() / hud.el
//
// phase 가 'alert' 인 동안 '영웅 출동!' 띠가 뜹니다. 글자는 아래 TEXT, 모양은 css/villain-raid.css 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { el, escapeHTML, money, bump, askDialog } from './uiKit.js';
import { icon } from './uiIcons.js';
import { heroFace } from './lairArt.js';

const TEXT = {
  town: '마을 부서짐',
  earned: '번 돈',
  quit: '그만두기',
  quitAsk: '습격을 그만둘까요?',
  quitNote: '지금까지 번 돈은 받아요',
  quitYes: '그만둘래요',
  quitNo: '계속 부수기',
  alert: '영웅 출동!',
  alertSub: (name) => `${name}가 달려오고 있어요`,
  heroAt: (percent) => `${percent}% 부서지면 영웅이 와요`,
  captions: {
    building: '블록이 모여 괴수가 되는 중…',
    duel: (name) => `${name}와 맞대결!`,
    cleanup: (left) => `남은 마을 마저 부수기! ${left}초`,
  },
};

const LOW_HP = 0.3; // 체력이 이 비율 아래면 막대가 빨갛게 깜빡임
const MONEY_TICK = 9; // 번 돈 숫자가 따라가는 빠르기 (클수록 빨리)

export function createRaidHud(root, { onSpeed, onQuit, onPause, speeds = VILLAIN.speedOptions } = {}) {
  // 이번 마을 영웅 (마을마다 다름 → show / setHero 로 바꿈)
  const hero = { name: VILLAIN.hero.name, kind: 'knight' };
  let heroAt = Math.round(VILLAIN.hero.appearAtDestroyed * 100);
  const hud = el(`
    <section class="hud" hidden aria-label="습격 정보">
      <div class="hud-floats" data-floats></div>
      <div class="hud-edge" aria-hidden="true"></div>
      <div class="hud-top">
        <div class="hud-fighter hud-fighter--monster" data-monster>
          <span class="hud-face"><img alt="" data-thumb draggable="false"></span>
          <div class="hud-fighter-body">
            <span class="hud-name" data-name>괴수</span>
            <div class="hud-bar" role="img" aria-label="괴수 체력"><i class="hud-bar-ghost"></i><i class="hud-bar-fill"></i></div>
          </div>
        </div>
        <div class="hud-town">
          <div class="hud-earned" title="${TEXT.earned}">${icon('coin')}<b data-earned>0</b></div>
          <div class="hud-town-row">
            <span class="hud-town-label">${icon('house')}${TEXT.town}</span>
            <div class="hud-town-bar" title="${TEXT.heroAt(heroAt)}">
              <i class="hud-town-fill"></i>
              <span class="hud-town-mark" style="left:${heroAt}%" data-heromark>${heroFace(hero.kind)}</span>
            </div>
            <b class="hud-town-num" data-percent>0%</b>
          </div>
        </div>
        <div class="hud-fighter hud-fighter--hero" data-hero hidden>
          <div class="hud-fighter-body">
            <span class="hud-name" data-heroname>${escapeHTML(hero.name)}</span>
            <div class="hud-bar" role="img" aria-label="영웅 체력"><i class="hud-bar-ghost"></i><i class="hud-bar-fill"></i></div>
          </div>
          <span class="hud-face" data-heroface>${heroFace(hero.kind)}</span>
        </div>
      </div>
      <div class="hud-alert" data-alert hidden role="alert">
        <i class="hud-siren"></i>
        <div class="hud-alert-text"><strong>${TEXT.alert}</strong><span data-alertsub>${escapeHTML(TEXT.alertSub(hero.name))}</span></div>
        <i class="hud-siren"></i>
      </div>
      <p class="hud-caption" data-caption hidden></p>
      <div class="hud-bottom">
        <button type="button" class="vt-btn hud-btn" data-act="quit">${icon('stop')}<span>${TEXT.quit}</span></button>
        <span class="hud-bottom-gap"></span>
        <button type="button" class="vt-btn vt-btn--icon hud-btn" data-sound-toggle aria-label="소리">${icon('soundOn')}</button>
        <button type="button" class="vt-btn hud-btn hud-speed" data-act="speed" aria-label="빠르기">${icon('speed')}<b data-speed>1×</b></button>
      </div>
    </section>`);
  root.append(hud);

  const q = (selector) => hud.querySelector(selector);
  const monsterBox = q('[data-monster]');
  const heroBox = q('[data-hero]');
  const earnedEl = q('[data-earned]');
  const percentEl = q('[data-percent]');
  const townBar = q('.hud-town-bar');
  const alertEl = q('[data-alert]');
  const captionEl = q('[data-caption]');
  const speedEl = q('[data-speed]');

  let speed = speeds[0] ?? 1;
  let shown = null; // 지금 화면에 그려진 값 (같으면 다시 안 그림)
  let moneyShown = 0;
  let lastTime = 0;

  function reset() {
    shown = { earned: 0, percent: -1, monster: -1, hero: -1, heroVisible: false, passed: false, phase: '', caption: '' };
    moneyShown = 0;
    earnedEl.textContent = '0';
    percentEl.textContent = '0%';
    hud.style.setProperty('--town', '0');
    setBar(monsterBox, 1, true);
    setBar(heroBox, 1, true);
    heroBox.hidden = true;
    alertEl.hidden = true;
    captionEl.hidden = true;
    townBar.classList.remove('is-passed');
    hud.classList.remove('is-alert', 'is-duel');
  }

  function setBar(box, ratio, instant = false) {
    const value = Math.max(0, Math.min(1, ratio));
    box.style.setProperty('--hp', value.toFixed(3));
    box.classList.toggle('is-low', value <= LOW_HP && value > 0);
    box.classList.toggle('is-out', value <= 0);
    if (instant) box.classList.remove('is-hurt');
  }

  function update(view = {}) {
    if (!shown) reset();
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTime) / 1000 || 0);
    lastTime = now;

    // 번 돈: 또르르 따라 올라감
    const earned = Math.round(view.earned ?? 0);
    if (earned !== shown.earned) {
      if (earned > shown.earned) bump(q('.hud-earned'), 'is-bump');
      shown.earned = earned;
    }
    if (moneyShown !== earned) {
      const step = (earned - moneyShown) * Math.min(1, dt * MONEY_TICK);
      moneyShown = Math.abs(earned - moneyShown) < 1 || document.body.classList.contains('capture') ? earned : moneyShown + step;
      earnedEl.textContent = money(moneyShown);
    }

    // 마을 부서짐
    const ratio = Math.max(0, Math.min(1, view.destroyedRatio ?? 0));
    const percent = Math.round(ratio * 100);
    if (percent !== shown.percent) {
      shown.percent = percent;
      percentEl.textContent = `${percent}%`;
      hud.style.setProperty('--town', ratio.toFixed(3));
    }
    const passed = percent >= heroAt || !!view.heroVisible || view.phase === 'alert' || view.phase === 'duel' || view.phase === 'cleanup';
    if (passed !== shown.passed) {
      shown.passed = passed;
      townBar.classList.toggle('is-passed', passed);
    }

    // 괴수 체력 (줄어들면 움찔)
    const monsterRatio = view.monsterMaxHp > 0 ? (view.monsterHp ?? 0) / view.monsterMaxHp : 1;
    if (Math.abs(monsterRatio - shown.monster) > 0.002) {
      if (shown.monster >= 0 && monsterRatio < shown.monster) bump(monsterBox, 'is-hurt');
      shown.monster = monsterRatio;
      setBar(monsterBox, monsterRatio);
    }

    // 영웅 체력 (나타나면 옆에서 미끄러져 들어옴)
    const heroVisible = !!view.heroVisible;
    if (heroVisible !== shown.heroVisible) {
      shown.heroVisible = heroVisible;
      if (heroVisible) {
        heroBox.hidden = false;
        shown.hero = -1;
        setBar(heroBox, 1, true);
        bump(heroBox, 'is-arrive');
      }
    }
    if (heroVisible) {
      const heroRatio = view.heroMaxHp > 0 ? (view.heroHp ?? 0) / view.heroMaxHp : 1;
      if (Math.abs(heroRatio - shown.hero) > 0.002) {
        if (shown.hero >= 0 && heroRatio < shown.hero) bump(heroBox, 'is-hurt');
        shown.hero = heroRatio;
        setBar(heroBox, heroRatio);
      }
    }

    // 장면에 따른 띠와 한 줄 안내
    const phase = view.phase ?? '';
    if (phase !== shown.phase) {
      shown.phase = phase;
      alertEl.hidden = phase !== 'alert';
      hud.classList.toggle('is-alert', phase === 'alert');
      hud.classList.toggle('is-duel', phase === 'duel');
    }
    let caption = '';
    if (phase === 'building') caption = TEXT.captions.building;
    else if (phase === 'duel') caption = TEXT.captions.duel(hero.name);
    else if (phase === 'cleanup' && view.cleanupLeft > 0) caption = TEXT.captions.cleanup(Math.ceil(view.cleanupLeft));
    if (caption !== shown.caption) {
      const kindChanged = !caption || !shown.caption || caption.slice(0, 4) !== shown.caption.slice(0, 4);
      shown.caption = caption;
      captionEl.textContent = caption;
      captionEl.hidden = !caption;
      captionEl.dataset.phase = phase;
      if (caption && kindChanged) bump(captionEl, 'is-enter');
    }
  }

  // raidDirector 의 raid 에서 값을 읽어 옴
  function sync(raid) {
    if (!raid) return;
    const state = raid.state ?? {};
    const monster = raid.monster;
    const heroNow = raid.hero;
    update({
      earned: state.earned,
      destroyedRatio: state.destroyedRatio,
      phase: state.phase,
      cleanupLeft: state.cleanupLeft,
      monsterHp: monster?.hp ?? 0,
      monsterMaxHp: monster?.maxHp ?? 0,
      heroHp: heroNow?.hp ?? 0,
      heroMaxHp: heroNow?.maxHp ?? 0,
      heroVisible: !!heroNow && (heroNow.active || (shown?.heroVisible && state.phase !== 'building')),
    });
  }

  // 이번 마을 영웅의 이름 · 얼굴 · 나오는 지점
  function setHero({ heroName = null, heroKind = null, heroAt: at = null } = {}) {
    if (heroName) hero.name = heroName;
    if (heroKind) hero.kind = heroKind;
    if (Number.isFinite(at)) heroAt = Math.round(Math.max(0, Math.min(1, at)) * 100);
    q('[data-heroname]').textContent = hero.name;
    q('[data-heroface]').innerHTML = heroFace(hero.kind);
    q('[data-alertsub]').textContent = TEXT.alertSub(hero.name);
    const mark = q('[data-heromark]');
    mark.innerHTML = heroFace(hero.kind);
    mark.style.left = `${heroAt}%`;
    townBar.title = TEXT.heroAt(heroAt);
    if (shown) shown.passed = null; // 다음 update 에서 '지나감' 표시를 다시 셈
  }

  function setSpeed(next) {
    speed = next;
    speedEl.textContent = `${next}×`;
    q('.hud-speed').classList.toggle('is-fast', next > 1);
  }

  hud.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    if (button.dataset.act === 'speed') {
      const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length] ?? 1;
      setSpeed(next);
      bump(button, 'is-bump');
      onSpeed?.(next);
    } else if (button.dataset.act === 'quit') {
      onPause?.(true);
      const yes = await askDialog(hud, { title: TEXT.quitAsk, message: TEXT.quitNote, yes: TEXT.quitYes, no: TEXT.quitNo, danger: true });
      onPause?.(false);
      if (yes) onQuit?.();
    }
  });

  setSpeed(speed);
  reset();

  return {
    el: hud,
    floatLayer: q('[data-floats]'),
    update,
    sync,
    setSpeed,
    setHero,
    get speed() {
      return speed;
    },
    show({ name = '괴수', thumb = '', heroName = null, heroKind = null, heroAt = null } = {}) {
      reset();
      setHero({ heroName, heroKind, heroAt });
      q('[data-name]').textContent = name;
      const img = q('[data-thumb]');
      if (thumb) img.src = thumb;
      img.hidden = !thumb;
      hud.querySelector(':scope > .vt-dialog')?.remove();
      hud.hidden = false;
      bump(hud, 'is-enter');
    },
    hide() {
      hud.hidden = true;
      hud.querySelector(':scope > .vt-dialog')?.remove();
    },
    // 정보판이 가리는 크기 (세로 화면에서는 아래 단추 줄도 가림)
    getInsets() {
      if (hud.hidden) return { top: 0, bottom: 0, left: 0, right: 0 };
      const top = q('.hud-top').getBoundingClientRect().bottom;
      const bottomBar = q('.hud-bottom').getBoundingClientRect();
      const portrait = innerHeight > innerWidth;
      return { top: Math.round(top), bottom: portrait && bottomBar.height > 0 ? Math.round(innerHeight - bottomBar.top) : 0, left: 0, right: 0 };
    },
  };
}
