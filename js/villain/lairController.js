// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 소굴 조종 (소굴 화면 + 3D 소굴 + 짓기 · 강화 · 옮기기 · 팔기 · 목표 · 계책 · 악명 단계)
// 소굴 화면(ui/lairScreen.js)의 단추와 3D 소굴(lair/lairView.js)의 누름을 받아 저장을 바꾸고, 다시 보여 줍니다.
// 모든 일을 한 뒤에는 곧바로 저장해요 (saveStore.update).
//
//   const lair = createLairController({ uiRoot, saveStore, bestiary, gameState, sounds, events, manual,
//                                       thumbOf, onOpenEditor, onShop, onRaid, onCopy, onRemove })
//       manual: true 면 3D 소굴이 스스로 돌지 않음 (녹화 ?capture) → lair.update(dt) · lair.render() 로 한 장면씩
//       onRaid(design, townId) : 마을 지도에서 [출동!]
//   lair.screen                     screens.add('lair', lair.screen) 에 넣을 것 { el, show(), hide() }
//   lair.refresh()                  저장이 바뀐 뒤 화면 · 3D 다시 그리기
//   lair.queueRankUp(info)          악명 단계 오름 축하를 다음에 소굴이 보일 때 (gameState.rankUpInfo 결과)
//   lair.setLastDesign(id)          마을 지도에서 처음 골라 둘 괴수
//   lair.update(dt) / lair.render() 녹화(수동) 때 3D 소굴 한 장면
//   lair.actions                    { build(type, x, y), upgrade(id), move(id, x, y), sell(id), claim(key), spot(type) }
//                                   화면 없이도 쓰는 짓기 함수 (돈 · 악명 단계 검사, 저장, 3D 움직임, 소리) → { ok, reason, id? }
//   lair.view / lair.ui             3D 소굴 · 소굴 화면 (시험용)
//
// 글자는 아래 TEXT 에서 바꿉니다. 시설 값 · 효과는 data/facilities.js, 계책은 data/schemes.js 에 있어요.
// ─────────────────────────────────────────────────────────────

import { FACILITIES, sellRefundOf } from './data/facilities.js';
import { SCHEMES } from './data/schemes.js';
import { RANKS } from './data/ranks.js';
import * as sim from './lair/lairSim.js';
import { claimGoal, markSchemesSeen } from './lair/goalTracker.js';
import { createLairScreen } from './ui/lairScreen.js';
import { createLairView } from './lair/lairView.js';
import { lockText } from './ui/lairKit.js';
import { money, toast } from './ui/uiKit.js';

const TEXT = {
  welcome: '악당 소굴에 어서 와요! 위의 목표를 하나씩 해 봐요',
  poorBuild: (name, n) => `${name}을(를) 지을 돈이 ${money(n)} 모자라요. 마을을 부숴서 벌어 와요`,
  poorUp: (n) => `강화할 돈이 ${money(n)} 모자라요. 한 번 더 출동해 봐요`,
  pickSpot: '먼저 3D 소굴에서 놓을 자리를 눌러요',
  noSpot: '빈자리가 없어요. 시설을 옮기거나 팔아 봐요',
  built: (name) => `${name}을(를) 지었어요!`,
  upgraded: (name, lv) => `${name} ${lv}레벨이 됐어요!`,
  moved: (name) => `${name}을(를) 옮겼어요`,
  sold: (name, n) => `${name}을(를) 팔고 ${money(n)}원을 돌려받았어요`,
  newScheme: (names) => `새 계책 발견: ${names.join(', ')}!`,
  rankStamp: '악명 단계 UP!',
  rankToast: (r) => `악명 ${r.rank}단계 '${r.name}'! 소굴 땅이 넓어졌어요`,
  opened: (lines) => `새로 열림: ${lines.join(' · ')}`,
};

const RANK_PARTY_MS = 4200; // 단계 오름 축하 카드가 떠 있는 시간 (1/1000초)
const GOAL_THEN_RANK = 1500; // 목표 보상으로 단계가 오르면 목표 축하 뒤 이만큼 있다가 (1/1000초)

export function createLairController(options) {
  const { uiRoot, saveStore, bestiary, gameState: gs, sounds, events, manual = false } = options;
  const ui = { placing: null, ghost: null, ghostLocked: false, selectedId: null, lastDesignId: null, welcome: undefined };
  const rankQueue = [];
  let shown = false;
  let hintKey = '';
  let welcomed = false;

  const play = (name) => sounds?.play(name);
  const save = () => saveStore.getSave();
  const moneyEvent = (before) => {
    const now = save().money;
    if (now !== before) events?.emit('moneyChanged', { money: now, delta: now - before });
  };

  // ── 소굴 화면 ──
  const screen = createLairScreen(uiRoot, {
    onBuildChoose: (type) => startBuild(type),
    onPlaceConfirm: () => confirmPlace(),
    onPlaceCancel: () => cancelPlace(),
    onUpgrade: (id) => upgrade(id),
    onMoveStart: (id) => startMove(id),
    onSell: (id) => sell(id),
    onSelect: (id) => select(id, { renderUI: true }),
    onClaimGoal: (key) => claim(key),
    onOpenEditor: (design) => options.onOpenEditor?.(design),
    onCopy: (design) => options.onCopy?.(design),
    onRemove: (design) => options.onRemove?.(design),
    onShop: () => options.onShop?.(),
    onRaid: (design, townId) => options.onRaid?.(design, townId),
    costOf: gs.costOf,
    baseCostOf: gs.baseCostOf,
    blocksOf: bestiary.countBlocks,
    hpOf: gs.hpOf,
    thumbOf: options.thumbOf,
    refundOf: (b) => sellRefundOf(b.type, b.level),
    onViewResize: (rect, insets) => {
      view.resize();
      view.setInsets(insets);
    },
    onPanelChange: () => syncVisible(),
  });

  // ── 3D 소굴 (lair.viewBox 에 붙임) ──
  const view = createLairView(screen.viewBox, {
    manual,
    onTap: (spot) => onViewTap(spot),
    onGhostMove: (spot) => onGhostMove(spot),
  });

  // 컴퓨터 마우스: 짓는 중에 마우스만 올려도 유령이 따라다니며 계책을 미리 보여 줌 (눌러서 고르기 전까지).
  // 한 번 눌러 자리를 고르면 [짓기 ✓] 단추로 가는 동안 유령이 따라가지 않게 그 자리에 붙잡아 둠 (다시 누르면 옮겨짐).
  let lastPointer = { type: 'mouse', buttons: 0 };
  const notePointer = (event) => {
    lastPointer = { type: event.pointerType || 'mouse', buttons: event.type === 'pointerdown' ? 1 : event.buttons };
  };
  screen.viewBox.addEventListener('pointermove', notePointer, { capture: true, passive: true });
  screen.viewBox.addEventListener('pointerdown', notePointer, { capture: true, passive: true });

  function onGhostMove(spot) {
    if (!ui.placing || spot?.x == null) return;
    const hovering = lastPointer.type === 'mouse' && !lastPointer.buttons;
    if (hovering && ui.ghostLocked && ui.ghost) {
      view.setGhost(ui.ghost.x, ui.ghost.y, ui.placing.preview); // 고른 자리로 되돌림
      return;
    }
    setGhost(spot.x, spot.y);
  }

  // 소굴이 보이고 마을 지도가 안 덮을 때만 3D 를 돌림 (그리기 · 상점 · 습격 중에는 멈춤)
  function syncVisible() {
    view.setVisible(shown && screen.panel !== 'towns');
  }

  // ── 그리기 ──
  function renderUI() {
    screen.render(gs.lairState({ placing: ui.placing, selectedId: ui.selectedId, lastDesignId: ui.lastDesignId, welcome: ui.welcome }));
  }

  function syncView() {
    view.setLair(save().lair, gs.evaluation());
    if (!ui.placing) view.select(ui.selectedId);
  }

  function refresh() {
    syncView();
    renderUI();
  }

  // ── 3D 누름 ──
  function onViewTap({ x, y, buildingId } = {}) {
    if (ui.placing) {
      if (x == null) return; // 하늘
      setGhost(x, y);
      ui.ghostLocked = true;
      return;
    }
    select(buildingId ?? null, { renderUI: true });
    if (buildingId != null) play('click');
  }

  function select(id, { renderUI: redraw = false } = {}) {
    ui.selectedId = id != null && sim.findBuilding(save().lair, id) ? id : null;
    view.select(ui.selectedId);
    if (redraw) renderUI();
  }

  // ── 짓기 · 옮기기 자리 고르기 ──
  function startBuild(type) {
    const def = FACILITIES[type];
    if (!def) return;
    const check = buildCheck(type);
    if (!check.ok) {
      toast(check.reason, { kind: 'bad' });
      play('nope');
      return;
    }
    const spot = sim.findSpot(save().lair, type);
    if (!spot) {
      toast(TEXT.noSpot, { kind: 'bad' });
      play('nope');
      return;
    }
    ui.placing = { type, moveId: null, preview: null };
    ui.ghostLocked = false;
    ui.selectedId = null;
    view.select(null);
    view.startPlacing(type);
    hintKey = '';
    setGhost(spot.x, spot.y);
  }

  function startMove(id) {
    const b = sim.findBuilding(save().lair, id);
    if (!b) return;
    ui.placing = { type: b.type, moveId: id, preview: null };
    ui.ghostLocked = false;
    view.startPlacing(b.type, { moveId: id });
    hintKey = '';
    setGhost(b.x, b.y);
  }

  function setGhost(x, y) {
    const p = ui.placing;
    if (!p) return;
    if (ui.ghost && ui.ghost.x === x && ui.ghost.y === y && p.preview) return;
    ui.ghost = { x, y };
    const preview = sim.previewPlace(save().lair, p.type, x, y, { moveId: p.moveId });
    ui.placing = { ...p, preview };
    view.setGhost(x, y, preview);
    // 이 자리에 놓으면 계책이 켜져요 → 반짝 소리
    const key = preview.valid ? preview.gained.join(',') : '';
    if (key && key !== hintKey) play('hint');
    hintKey = key;
    renderUI();
  }

  function confirmPlace() {
    const p = ui.placing;
    if (!p) return;
    if (!ui.ghost || !p.preview) {
      toast(TEXT.pickSpot);
      return;
    }
    if (!p.preview.valid) {
      toast(p.preview.reason || '여기는 안 돼요', { kind: 'bad' });
      play('nope');
      return;
    }
    const { x, y } = ui.ghost;
    const result = p.moveId != null ? move(p.moveId, x, y, { fromUI: true }) : build(p.type, x, y, { fromUI: true });
    if (!result.ok) {
      toast(result.reason, { kind: 'bad' });
      play('nope');
    }
  }

  function cancelPlace() {
    endPlacing();
    renderUI();
  }

  function endPlacing() {
    if (!ui.placing) return;
    ui.placing = null;
    ui.ghost = null;
    ui.ghostLocked = false;
    view.stopPlacing();
  }

  // ── 저장을 바꾸는 일 (화면에서도, 시험 도구에서도 씀) ──
  function buildCheck(type) {
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

  function build(type, x, y, { fromUI = false } = {}) {
    const check = buildCheck(type);
    if (!check.ok) return check;
    const place = sim.place(save().lair, type, x, y);
    if (!place.ok) return { ok: false, reason: place.reason };
    const before = save().money;
    saveStore.update((s) => {
      s.lair = place.lair;
      s.money -= check.price;
    });
    moneyEvent(before);
    if (fromUI || ui.placing) endPlacing();
    const fresh = afterChange({ built: place.id });
    play('build');
    if (fromUI && !fresh.length) toast(TEXT.built(FACILITIES[type].name), { kind: 'good' });
    return { ok: true, id: place.id };
  }

  function move(id, x, y, { fromUI = false } = {}) {
    const b = sim.findBuilding(save().lair, id);
    const moved = sim.move(save().lair, id, x, y);
    if (!moved.ok) return { ok: false, reason: moved.reason };
    saveStore.update((s) => {
      s.lair = moved.lair;
    });
    if (fromUI || ui.placing) endPlacing();
    const fresh = afterChange({});
    play('move');
    if (fromUI && !fresh.length && b && (b.x !== x || b.y !== y)) toast(TEXT.moved(FACILITIES[b.type]?.name ?? ''));
    return { ok: true, id };
  }

  function upgrade(id) {
    const s = save();
    const b = sim.findBuilding(s.lair, id);
    const price = sim.upgradePrice(s.lair, id);
    if (!b || price == null) {
      const reason = b ? sim.REASONS.maxLevel : sim.REASONS.missing;
      toast(reason, { kind: 'bad' });
      return { ok: false, reason };
    }
    if (s.money < price) {
      const reason = TEXT.poorUp(price - s.money);
      toast(reason, { kind: 'bad' });
      play('nope');
      return { ok: false, reason };
    }
    const up = sim.upgrade(s.lair, id);
    if (!up.ok) return { ok: false, reason: up.reason };
    const before = s.money;
    saveStore.update((next) => {
      next.lair = up.lair;
      next.money -= up.price;
    });
    moneyEvent(before);
    const fresh = afterChange({ upgraded: id });
    play('upgrade');
    if (!fresh.length) toast(TEXT.upgraded(FACILITIES[b.type]?.name ?? '', b.level + 1), { kind: 'good' });
    return { ok: true, id, price: up.price };
  }

  function sell(id) {
    const s = save();
    const b = sim.findBuilding(s.lair, id);
    const removed = sim.remove(s.lair, id);
    if (!b || !removed.ok) {
      if (removed.reason) toast(removed.reason, { kind: 'bad' });
      return { ok: false, reason: removed.reason };
    }
    const before = s.money;
    saveStore.update((next) => {
      next.lair = removed.lair;
      next.money += removed.refund;
    });
    moneyEvent(before);
    if (ui.selectedId === id) ui.selectedId = null;
    view.playRemove(id);
    afterChange({});
    play('sell');
    toast(TEXT.sold(FACILITIES[b.type]?.name ?? '', removed.refund));
    return { ok: true, refund: removed.refund };
  }

  function claim(key) {
    const rankBefore = gs.rank().rank;
    const before = save().money;
    let goal = null;
    saveStore.update((s) => {
      goal = claimGoal(s, key, { evaluation: gs.evaluation() });
    });
    if (!goal) {
      renderUI();
      return { ok: false, reason: '아직 다 못 했어요' };
    }
    moneyEvent(before);
    play('goal');
    const up = gs.rankUpInfo(rankBefore, gs.rank().rank);
    if (up) {
      rankQueue.push(up);
      setTimeout(() => flushRanks(), GOAL_THEN_RANK); // 목표 축하 카드가 먼저 보이게
    }
    refresh();
    return { ok: true, goal };
  }

  // 시설이 바뀐 뒤: 3D · 화면 다시 그리기 + 처음 켜진 계책 알리기 → 처음 켜진 계책 키 목록
  function afterChange({ built = null, upgraded = null } = {}) {
    syncView();
    if (built != null) view.playBuild(built);
    if (upgraded != null) view.playUpgrade(upgraded);
    const fresh = announceSchemes();
    renderUI();
    return fresh;
  }

  function announceSchemes() {
    let fresh = [];
    const ev = gs.evaluation();
    if (!(ev?.schemes ?? []).some((x) => !save().schemesSeen.includes(x.key))) return fresh;
    saveStore.update((s) => {
      fresh = markSchemesSeen(s, ev);
    });
    if (!fresh.length) return fresh;
    toast(TEXT.newScheme(fresh.map((k) => SCHEMES[k]?.name ?? k)), { kind: 'good' });
    for (const key of fresh) view.pulseScheme(key);
    setTimeout(() => play('scheme'), 450); // 시설이 다 쌓일 즈음
    return fresh;
  }

  // ── 악명 단계 오름 축하 (땅은 setLair 가 크게 만들며 솟아오름) ──
  function queueRankUp(info) {
    if (info) rankQueue.push(info);
  }

  function flushRanks() {
    if (!shown || !rankQueue.length) return;
    const list = rankQueue.splice(0);
    const top = list[list.length - 1];
    const lines = [...new Set(list.flatMap((r) => r.lines))];
    screen.celebrateGoal({
      stamp: TEXT.rankStamp,
      name: `${top.emoji ?? ''} ${top.name}`.trim(),
      icon: `rank:${top.rank}`,
      quip: lines.length ? TEXT.opened(lines) : '',
      reward: {},
      ms: RANK_PARTY_MS,
    });
    toast(TEXT.rankToast(top), { kind: 'good' });
    play('rankUp');
    view.showLand(save().lair.size);
  }

  // ── 화면 켜고 끄기 ──
  function show() {
    shown = true;
    if (!welcomed && !(save().stats?.raids > 0)) ui.welcome = TEXT.welcome;
    welcomed = true;
    if (ui.selectedId != null && !sim.findBuilding(save().lair, ui.selectedId)) ui.selectedId = null;
    screen.show(gs.lairState({ placing: ui.placing, selectedId: ui.selectedId, lastDesignId: ui.lastDesignId, welcome: ui.welcome }));
    syncVisible();
    view.setInsets(screen.getViewInsets());
    syncView(); // 땅이 넓어졌으면 여기서 새 칸이 솟아오름
    announceSchemes();
    if (rankQueue.length) setTimeout(() => flushRanks(), 350);
  }

  function hide() {
    shown = false;
    endPlacing();
    screen.hide();
    syncVisible();
  }

  return {
    screen: { el: screen.el, show, hide },
    ui: screen,
    view,
    refresh,
    queueRankUp,
    setLastDesign(id) {
      ui.lastDesignId = id ?? null;
    },
    update(dt) {
      if (manual && shown) view.step(dt, { render: false });
    },
    render() {
      if (manual && shown) view.step(0, { render: true });
    },
    get shown() {
      return shown;
    },
    actions: {
      build: (type, x, y) => build(type, x, y),
      upgrade,
      move: (id, x, y) => move(id, x, y),
      sell,
      claim,
      spot: (type, near) => sim.findSpot(save().lair, type, near ? { near } : {}),
      check: buildCheck,
    },
  };
}
