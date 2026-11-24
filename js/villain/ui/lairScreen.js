// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 악당 소굴 (첫 화면) — 3D 소굴이 화면 대부분을 차지하고, 둘레에 머리줄 · 목표 · 아래 단추.
//   머리줄: 로고, 악명 휘장(단계 이름 + 다음 단계까지 막대), 가진 돈, 소리
//   목표 띠: 목표 3개 (goalsBar.js)          가운데: lair.viewBox ← game.js 가 3D 소굴을 여기에 붙임
//   아래 단추: [짓기] [괴수 도감] [부품 상점] [출동!]      3D 위 작은 단추: [계책 도감]
//   판(시트): 언제나 왼쪽 옆판 (가로 화면 전용). 판이 가리는 만큼 3D 칸이 줄어 소굴이 다 보여요.
//   자리 고르기 중에는 판이 접히고 얇은 띠만 남아요 (buildMenu.js 의 createPlaceBar).
// 이 화면은 보여 주기와 누름 알리기만 합니다. 저장 · 화면 바꾸기 · 3D 는 부른 쪽(game.js)이 합니다.
//
// 쓰는 법
//   const lair = createLairScreen(root, {
//     onBuildChoose(type), onPlaceConfirm(), onPlaceCancel(),               짓기 / 자리 고르기
//     onUpgrade(id), onMoveStart(id), onSell(id), onSelect(id|null)?,       시설 판 (팔기는 이 화면이 먼저 물어봄)
//     onClaimGoal(key)?,                                                     목표 보상 받기 (없으면 완료 표시만)
//     onOpenEditor(design|null), onCopy(design), onRemove(design), onShop(),
//     onRaid(design, townId),                                                마을 지도에서 [출동!]
//     costOf(design) (소굴 효과 반영 값), baseCostOf(design)?, blocksOf(design), hpOf(design)?, thumbOf(design)?,
//     refundOf(building, def)?, onPanelChange(name|null)?,
//     onViewResize(rect, insets)?   3D 상자 크기가 바뀜 → view.resize(); view.setInsets(insets) (insets: 계책 단추가 가리는 위쪽 px)
//   })
//   lair.render(state)   state = { money, notoriety, rank, nextRank, ranks?, goals, facilities, lair, evaluation,
//                                  modsSummary, designs, towns, placing, selectedId, schemes, schemesSeen,
//                                  lastDesignId?, welcome?, stats? }   (일부만 줘도 됨: 앞의 값과 합침.
//                                  towns 가 없으면 꼬마 마을 하나, goals 가 없으면 목표 띠를 숨김)
//   lair.viewBox         3D 소굴을 붙일 상자 (판이 열리면 가려지지 않게 줄어듦 → onViewResize)
//   lair.getViewInsets() { top, bottom, left, right } 3D 상자 위에 떠 있는 단추가 가리는 px
//   lair.openPanel('build' | 'facility' | 'schemes' | 'bestiary' | 'towns') / lair.closePanel() / lair.panel
//   lair.celebrateGoal(goal)    목표 달성 축하 카드 (게임이 목표를 저절로 받을 때)
//   lair.show(state?) / lair.hide() / lair.el
//   (1단계 이름 onEdit(design) · onNew() 도 받아요)
//
// 글자는 아래 TEXT, 모양은 css/villain-lair.css (틀) · css/villain-lair2.css (판들) 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { el, money, countTo, bump, toast } from './uiKit.js';
import { icon, MASCOT } from './uiIcons.js';
import { lairIcon } from './lairArt.js';
import { effectChips } from './lairKit.js';
import { createNotorietyBadge } from './notorietyBadge.js';
import { createGoalsBar } from './goalsBar.js';
import { createBuildMenu, createPlaceBar } from './buildMenu.js';
import { createFacilityPanel } from './facilityPanel.js';
import { createSchemeBook } from './schemeBook.js';
import { createBestiaryPanel } from './bestiaryPanel.js';
import { createTownMap } from './townMap.js';

const TEXT = {
  build: '짓기',
  bestiary: '괴수 도감',
  shop: '부품 상점',
  raid: '출동!',
  schemes: '계책',
  mods: '지금 소굴 효과',
  noMods: '시설을 지으면 여기에 효과가 모여요',
  rankHint: (left) => (left > 0 ? `악명 ${money(left)} 더 모으면 다음 단계! 마을을 부수고 영웅을 이겨 봐요` : '가장 높은 악명 단계예요!'),
};

const HELLO_SECONDS = 6;

export function createLairScreen(root, options = {}) {
  const cb = options;
  const openEditor = (design) => (cb.onOpenEditor ? cb.onOpenEditor(design) : design ? cb.onEdit?.(design) : cb.onNew?.());

  const screen = el(`
    <section class="lair vt-screen" hidden aria-label="악당 소굴">
      <div class="lair-sky" aria-hidden="true"><i class="lair-star s1"></i><i class="lair-star s2"></i><i class="lair-star s3"></i><i class="lair-star s4"></i><i class="lair-star s5"></i></div>
      <div class="lair-viewcell" data-cell>
        <div class="lair-view" data-view></div>
        <button type="button" class="lair-bookbtn" data-act="schemes" aria-label="계책 도감">${lairIcon('book')}<span>${TEXT.schemes}</span><b data-found></b></button>
        <p class="lair-hello" data-hello hidden></p>
      </div>
      <header class="lair-top">
        <h1 class="vt-logo">${MASCOT}<span class="vt-logo-a">악당</span><span class="vt-logo-b">타이쿤</span></h1>
        <div class="lair-badge" data-badge></div>
        <div class="lair-wallet">
          <div class="vt-money" title="가진 돈">${icon('coin')}<b data-money>0</b></div>
          <button type="button" class="vt-btn vt-btn--icon" data-sound-toggle aria-label="소리">${icon('soundOn')}</button>
        </div>
        <i class="lair-drip d1" aria-hidden="true"></i><i class="lair-drip d2" aria-hidden="true"></i><i class="lair-drip d3" aria-hidden="true"></i>
      </header>
      <div class="lair-goals" data-goals><div class="lair-mods" data-mods></div></div>
      <nav class="lair-dock" aria-label="소굴 단추">
        <button type="button" class="vt-btn dock-btn dock-build" data-act="build">${lairIcon('hammer')}<span>${TEXT.build}</span></button>
        <button type="button" class="vt-btn dock-btn dock-book" data-act="bestiary">${lairIcon('monster')}<span>${TEXT.bestiary}</span></button>
        <button type="button" class="vt-btn vt-btn--gold dock-btn dock-shop" data-act="shop">${icon('shop')}<span>${TEXT.shop}</span></button>
        <button type="button" class="vt-btn vt-btn--go dock-btn dock-raid" data-act="raid">${icon('play')}<span>${TEXT.raid}</span></button>
      </nav>
      <div class="lair-sheet" data-sheet hidden></div>
    </section>`);
  root.append(screen);

  const cell = screen.querySelector('[data-cell]');
  const viewBox = screen.querySelector('[data-view]');
  const sheet = screen.querySelector('[data-sheet]');
  const moneyEl = screen.querySelector('[data-money]');
  const hello = screen.querySelector('[data-hello]');
  const dock = screen.querySelector('.lair-dock');

  let state = { money: 0, notoriety: 0, goals: undefined, facilities: [], designs: [], towns: null, placing: null, selectedId: null };
  let panel = null; // 지금 열린 판 이름
  let resumePanel = null; // 자리 고르기가 끝나면 다시 열 판
  let prevSelected = null;
  let prevPlacing = null;
  let firstRender = true;
  let helloTimer = 0;
  let lastHello = '';

  // ── 부품 화면들 ──
  const badge = createNotorietyBadge({
    onClick: () => toast(TEXT.rankHint(state.nextRank ? state.nextRank.at - (state.notoriety ?? 0) : 0)),
  });
  screen.querySelector('[data-badge]').append(badge.el);

  const goals = createGoalsBar({ host: screen, onClaim: cb.onClaimGoal ?? null, coinTarget: () => screen.querySelector('.lair-top .vt-money') });
  screen.querySelector('[data-goals]').prepend(goals.el);
  const modsEl = screen.querySelector('[data-mods]');
  let lastMods = '';

  const cardFns = { costOf: cb.costOf, baseCostOf: cb.baseCostOf, blocksOf: cb.blocksOf, hpOf: cb.hpOf, thumbOf: cb.thumbOf };
  const panels = {
    build: createBuildMenu({ onChoose: (type) => cb.onBuildChoose?.(type), onClose: () => closePanel() }),
    facility: createFacilityPanel({
      onUpgrade: (id) => cb.onUpgrade?.(id),
      onMove: (id) => cb.onMoveStart?.(id),
      onSell: (id) => cb.onSell?.(id),
      onClose: () => closePanel(),
      refundOf: cb.refundOf,
    }),
    schemes: createSchemeBook({ onClose: () => closePanel() }),
    bestiary: createBestiaryPanel({ ...cardFns, onOpenEditor: openEditor, onCopy: (d) => cb.onCopy?.(d), onRemove: (d) => cb.onRemove?.(d), onClose: () => closePanel() }),
  };
  for (const [name, p] of Object.entries(panels)) {
    p.el.dataset.panel = name;
    p.el.hidden = true;
    sheet.append(p.el);
  }
  const place = createPlaceBar({ onConfirm: () => cb.onPlaceConfirm?.(), onCancel: () => cb.onPlaceCancel?.() });
  screen.append(place.el);
  const towns = createTownMap({ ...cardFns, onRaid: (design, townId) => cb.onRaid?.(design, townId), onClose: () => closePanel() });
  screen.append(towns.el);

  // ── 판 열고 닫기 ──
  function setPanel(name, { notify = true } = {}) {
    const before = panel;
    if (before === 'facility' && name !== 'facility' && notify) cb.onSelect?.(null);
    panel = name;
    for (const [key, p] of Object.entries(panels)) p.el.hidden = key !== name;
    sheet.hidden = !name || name === 'towns';
    sheet.dataset.panel = name ?? '';
    screen.dataset.panel = name ?? '';
    if (name === 'towns') towns.open();
    else towns.close();
    if (name && name !== 'towns') {
      renderPanel(name);
      bump(sheet, 'is-enter');
      panels[name].body?.scrollTo?.(0, 0);
    }
    for (const b of dock.querySelectorAll('[data-act]')) b.classList.toggle('is-on', b.dataset.act === name);
    screen.querySelector('.lair-bookbtn').classList.toggle('is-on', name === 'schemes');
    updateCover();
    if (before !== name) cb.onPanelChange?.(name);
  }

  function openPanel(name) {
    if (name === 'facility' && state.selectedId == null) return;
    if (state.placing) return; // 자리 고르는 중에는 띠만
    setPanel(name);
  }

  function closePanel() {
    setPanel(null);
  }

  function togglePanel(name) {
    if (panel === name) closePanel();
    else openPanel(name);
  }

  // ── 판에 내용 넣기 ──
  function selectedBuilding() {
    return (state.lair?.buildings ?? []).find((b) => b.id === state.selectedId) ?? null;
  }

  function defOf(type) {
    return (state.facilities ?? []).find((f) => f.key === type) ?? null;
  }

  function townsOrDefault() {
    if (Array.isArray(state.towns) && state.towns.length) return state.towns;
    // 1단계 게임처럼 마을 목록이 없으면 꼬마 마을 하나
    return [{ id: 'village', name: VILLAIN.town.name, hero: 'knight', heroName: VILLAIN.hero.name, heroHint: VILLAIN.hero.hint, payMul: 1, unlocked: true, wins: state.stats?.wins ?? 0 }];
  }

  function renderPanel(name) {
    const s = state;
    if (name === 'build') panels.build.render({ facilities: s.facilities, money: s.money, rank: s.rank, ranks: s.ranks });
    else if (name === 'facility') {
      const b = selectedBuilding();
      if (b) panels.facility.render({ building: b, def: defOf(b.type) ?? { key: b.type, name: b.type, price: [] }, evaluation: s.evaluation, schemes: s.schemes, schemesSeen: s.schemesSeen, facilities: s.facilities, money: s.money });
    } else if (name === 'schemes') panels.schemes.render({ schemes: s.schemes, schemesSeen: s.schemesSeen, evaluation: s.evaluation, facilities: s.facilities, modsSummary: s.modsSummary });
    else if (name === 'bestiary') panels.bestiary.render({ designs: s.designs, money: s.money });
  }

  // ── 3D 칸: 판 · 띠가 가리는 만큼 줄이기 ──
  let coverKey = '';
  function updateCover() {
    if (screen.hidden || !cell.offsetParent) return;
    // 모두 화면 상자 기준 위치 (움직이는 중인 판의 transform 은 빼고 셈)
    const cellLeft = cell.offsetLeft;
    const cellBottom = cell.offsetTop + cell.offsetHeight;
    let bottom = 0;
    let left = 0;
    if (!sheet.hidden) left = Math.max(0, sheet.offsetLeft + sheet.offsetWidth - cellLeft);
    // 자리 고르기 띠가 3D 칸 아래쪽을 가로로 가리면 그만큼 (옆 기둥에 있을 때는 그대로)
    if (!place.el.hidden && place.el.offsetWidth >= cell.offsetWidth * 0.6 && place.el.offsetTop < cellBottom) {
      bottom = Math.max(bottom, cellBottom - place.el.offsetTop);
    }
    const key = `${Math.round(bottom)}|${Math.round(left)}`;
    if (key === coverKey) return;
    coverKey = key;
    viewBox.style.bottom = `${Math.round(bottom)}px`;
    viewBox.style.left = `${Math.round(left)}px`;
    screen.style.setProperty('--cover-left', `${Math.round(left)}px`); // 아래 단추 · 계책 단추도 비켜 서게
  }

  // 3D 상자 위에 떠 있는 것(계책 단추)이 가리는 만큼 (3D 카메라가 땅판을 그 아래로 맞추게)
  function viewInsets() {
    const book = screen.querySelector('.lair-bookbtn');
    if (screen.hidden || !book.offsetParent) return { top: 0, bottom: 0, left: 0, right: 0 };
    const v = viewBox.getBoundingClientRect();
    const b = book.getBoundingClientRect();
    return { top: Math.max(0, Math.round(b.bottom - v.top + 6)), bottom: 0, left: 0, right: 0 };
  }

  // 3D 상자 크기가 바뀌면 알려 줌 (한 장면에 한 번만)
  let resizeQueued = false;
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(() => {
        resizeQueued = false;
        cb.onViewResize?.(viewBox.getBoundingClientRect(), viewInsets());
      });
    }).observe(viewBox);
    new ResizeObserver(() => updateCover()).observe(screen);
  }
  window.addEventListener('resize', () => updateCover());

  // ── 그리기 ──
  function render(next = {}) {
    state = { ...state, ...next };
    const s = state;
    countTo(moneyEl, s.money, { from: firstRender ? s.money : null });
    badge.render({ notoriety: s.notoriety ?? 0, rank: s.rank, nextRank: s.nextRank });
    goals.render(s.goals);
    // 컴퓨터 화면 왼쪽 기둥: 지금 소굴 효과
    const modsKey = JSON.stringify(s.modsSummary ?? []);
    if (modsKey !== lastMods) {
      lastMods = modsKey;
      const list = (s.modsSummary ?? []).map((m) => ({ ...m, good: m.good !== false }));
      modsEl.innerHTML = `<small>${lairIcon('spark')}${TEXT.mods}</small><span>${list.length ? effectChips(list) : `<em>${TEXT.noMods}</em>`}</span>`;
    }
    const seen = (s.schemesSeen ?? []).length;
    screen.querySelector('[data-found]').textContent = s.schemes?.length ? `${seen}/${s.schemes.length}` : '';

    // 자리 고르기 시작 · 끝
    const placing = s.placing ?? null;
    if (placing && !prevPlacing) {
      resumePanel = panel === 'facility' ? 'facility' : null;
      setPanel(null, { notify: false });
    }
    if (!placing && prevPlacing) {
      const back = resumePanel;
      resumePanel = null;
      if (back === 'facility' && selectedBuilding()) setPanel('facility', { notify: false });
    }
    prevPlacing = placing;
    screen.classList.toggle('is-placing', !!placing);
    place.render({ placing, facilities: s.facilities, schemes: s.schemes, schemesSeen: s.schemesSeen, money: s.money });

    // 시설을 새로 누르면 시설 판
    if (s.selectedId !== prevSelected) {
      if (s.selectedId != null && !placing) setPanel('facility', { notify: false });
      else if (s.selectedId == null && panel === 'facility') setPanel(null, { notify: false });
    }
    prevSelected = s.selectedId;
    if (panel === 'facility' && !selectedBuilding()) setPanel(null, { notify: false });

    if (panel && panel !== 'towns') renderPanel(panel);
    towns.render({ towns: townsOrDefault(), designs: s.designs, money: s.money, modsSummary: s.modsSummary, ranks: s.ranks, lastDesignId: s.lastDesignId });

    // 인사 한 줄 (몇 초 뒤 사라짐)
    if (s.welcome && s.welcome !== lastHello) {
      lastHello = s.welcome;
      hello.textContent = s.welcome;
      hello.hidden = false;
      bump(hello, 'is-enter');
      clearTimeout(helloTimer);
      helloTimer = setTimeout(() => (hello.hidden = true), HELLO_SECONDS * 1000);
    }
    firstRender = false;
    updateCover();
  }

  // ── 누름 ──
  screen.addEventListener('click', (event) => {
    if (screen.querySelector(':scope > .vt-dialog') && !event.target.closest('.vt-dialog')) return;
    const button = event.target.closest('[data-act]');
    if (!button || button.closest('.lpanel, .placebar, .townmap')) return;
    const act = button.dataset.act;
    if (state.placing) {
      bump(screen.querySelector('.placebar'), 'is-shake');
      return;
    }
    if (act === 'build' || act === 'bestiary' || act === 'schemes') togglePanel(act);
    else if (act === 'shop') cb.onShop?.();
    else if (act === 'raid') openPanel('towns');
  });
  hello.addEventListener('click', () => (hello.hidden = true));

  // 키보드: Esc = 닫기 / 취소, Enter = 자리 고르기 확인
  document.addEventListener('keydown', (event) => {
    if (screen.hidden || event.defaultPrevented || screen.querySelector(':scope > .vt-dialog')) return;
    if (event.key === 'Escape') {
      if (state.placing) cb.onPlaceCancel?.();
      else if (panel === 'towns' && towns.step === 'monsters') towns.open();
      else if (panel) closePanel();
      else return;
      event.preventDefault();
    } else if (event.key === 'Enter' && state.placing && !event.target.closest?.('button')) {
      place.el.querySelector('[data-act="ok"]')?.click();
      event.preventDefault();
    }
  });

  return {
    el: screen,
    viewBox,
    render,
    openPanel,
    closePanel,
    get panel() {
      return panel;
    },
    celebrateGoal: (goal) => goals.celebrate(goal),
    getViewRect: () => viewBox.getBoundingClientRect(),
    getViewInsets: viewInsets,
    show(next) {
      screen.hidden = false;
      if (next) render(next);
      else updateCover();
      bump(screen, 'is-enter');
    },
    hide() {
      screen.querySelector(':scope > .vt-dialog [data-answer="no"]')?.click(); // 떠 있던 확인 창은 '아니요' 로 닫음
      goals.closePop();
      screen.querySelector(':scope > .goal-party')?.remove();
      if (panel === 'towns') setPanel(null, { notify: false });
      screen.hidden = true;
    },
  };
}
