// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 게임 본체 (모든 부품을 이어 붙이는 곳)
// 화면 흐름:  소굴 ⇄ 괴수 그리기,  소굴 ⇄ 부품 상점,  소굴 → 마을 지도 → 습격 → 결과 → 소굴 (또는 다시 출동)
// 3D 마을·괴수·영웅은 gameWorld.js, 소굴(화면 + 3D 소굴 + 짓기)은 lairController.js, 저장에서 값 뽑기는 gameState.js,
// 다른 화면들은 ui/*.js, 그리기는 draw/*.js 가 만들고, 여기서는 서로 연결만 합니다.
//
//   const game = createVillainGame({ container, uiRoot, capture })
//       container: 3D 마을을 그릴 상자 (#stage),  uiRoot: 화면을 넣을 상자 (#ui),  capture: 영상 녹화 모드 (소리 없음, 3D 소굴 수동)
//   game.update(dt)   한 장면 움직이기 (습격·결과 화면이면 3D 마을, 녹화 모드의 소굴 화면이면 3D 소굴)
//   game.render()     한 장면 그리기
//   game.debug        시험·디버그용 → main.js 가 window.villain 으로 내놓음
//       { state, saveStore, bestiary, raid, town (늘 지금 마을), world, screens, events, stage, hud, editor, sounds,
//         lair: { place(type, x, y), upgrade(id), move(id, x, y), sell(id), claim(key), spot(type), evaluate(), view, screen },
//         mods(), setNotoriety(n), setMoney(n), startRaid(designId, townId), openEditor(designId?), showLair() }
//       state: { screen, speed, paused, designId, townId }
//
// 돈이 다 떨어졌을 때의 '악당 지원금' 규칙은 아래 rescueIfBroke 에 있습니다.
// 게임 숫자는 villainConfig.js 와 data/*.js, 화면 글자는 각 화면 파일에서 바꿉니다. 이 파일의 글자는 아래 TEXT.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from './villainConfig.js';
import { createEvents } from '../game/core/events.js';
import { saveStore } from './data/saveStore.js';
import { bestiary } from './data/bestiary.js';
import { getTown } from './data/towns.js';
import { RANKS, nextRank } from './data/ranks.js';
import { recordRaid } from './lair/goalTracker.js';
import { createEditorScreen } from './draw/editorScreen.js';
import { designThumbURL } from './draw/pixelThumb.js';
import { createMonsterPreview, renderThumb } from './monster/monsterPreview.js';
import { createVillainSounds, connectVillainSounds } from './audio/villainSounds.js';
import { createScreens } from './ui/screens.js';
import { createShopScreen } from './ui/shopScreen.js';
import { createRaidHud } from './ui/raidHud.js';
import { createRaidZoom } from './raid/raidZoom.js';
import { createResultScreen } from './ui/resultScreen.js';
import { bindSoundButtons } from './ui/soundToggle.js';
import { lockText } from './ui/lairKit.js';
import { toast } from './ui/uiKit.js';
import { createGameWorld } from './gameWorld.js';
import { createGameState } from './gameState.js';
import { createLairController } from './lairController.js';

const TEXT = {
  copied: (name) => `'${name}' 괴수를 복사했어요`,
  saved: (name) => `'${name}' 괴수를 도감에 넣었어요`,
  removed: '괴수를 지웠어요',
  rescue: (amount) => `돈이 다 떨어져서 악당 협회가 지원금 ${amount}원을 줬어요`,
  noMonster: '출동할 괴수를 찾지 못했어요',
  keepMoney: (amount) => `괴수를 보낼 돈 ${amount}원은 남겨 둬야 해요. 조금 더 벌고 와요`,
  poor: (amount) => `돈이 모자라요 (${amount}원 필요)`,
  partLocked: (text) => `아직 못 사요. ${text}`,
};

export function createVillainGame({ container, uiRoot, capture = false }) {
  const events = createEvents();
  const sounds = createVillainSounds();
  const screens = createScreens();
  const gs = createGameState({ saveStore, bestiary });
  const state = { screen: 'boot', speed: 1, paused: false, designId: null, townId: 'village' };
  let resultDue = false; // 판이 끝나서 결과 화면을 띄울 차례
  let lastRaid = null; // 마지막 판의 { result, fame, rankUp } (결과 화면용, 기록은 한 번만)

  // ── 괴수 카드 그림 (블록 괴수 그림이 안 되면 도트 그림으로) ──
  const thumbOf = (design) => {
    try {
      return renderThumb(design, { size: 224 }) || designThumbURL(design, 160);
    } catch {
      return designThumbURL(design, 160);
    }
  };

  // ── 소굴 (화면 + 3D 소굴 + 짓기) ──
  const lair = createLairController({
    uiRoot,
    saveStore,
    bestiary,
    gameState: gs,
    sounds,
    events,
    manual: capture,
    thumbOf,
    onOpenEditor: (design) => openEditor(design),
    onShop: () => screens.show('shop', shopState()),
    onRaid: (design, townId) => startRaid(design, townId),
    onCopy: (design) => {
      const copy = bestiary.duplicate(design.id);
      lair.refresh();
      if (copy) toast(TEXT.copied(copy.name), { kind: 'good' });
    },
    onRemove: (design) => {
      if (bestiary.remove(design.id)) toast(TEXT.removed);
      lair.refresh();
    },
  });

  // ── 부품 상점 (연구실이 열어 준 부품만 살 수 있음. 이미 가진 부품은 그대로) ──
  const shopState = () => {
    const save = saveStore.getSave();
    return { money: save.money, ownedParts: save.ownedParts, ...gs.partState() };
  };
  const shop = createShopScreen(uiRoot, {
    onBack: () => showLair(),
    onBuy: (type) => {
      const part = VILLAIN.parts.types[type];
      const save = saveStore.getSave();
      if (!part || save.ownedParts.includes(type) || save.money < part.price) return false;
      const { available, locks } = gs.partState();
      if (!available.includes(type)) {
        sounds.play('nope');
        return { ok: false, message: TEXT.partLocked(locks[type] ?? '') };
      }
      // 가장 싼 괴수를 보낼 돈은 남겨 둠 (다 쓰고 지원금을 받아 부품을 거의 공짜로 사는 일을 막음)
      const keep = gs.cheapestCost();
      if (Number.isFinite(keep) && save.money - part.price < keep) {
        sounds.play('nope');
        return { ok: false, message: TEXT.keepMoney(keep) };
      }
      const saved = saveStore.update((s) => {
        s.money -= part.price;
        s.ownedParts.push(type);
      });
      events.emit('moneyChanged', { money: saved.money, delta: -part.price });
      sounds.play('buy');
      shop.render(shopState());
      return true;
    },
  });

  const hud = createRaidHud(uiRoot, {
    onSpeed: (scale) => {
      state.speed = scale;
    },
    onPause: (on) => {
      state.paused = !!on; // "그만둘까요?" 창이 떠 있는 동안 멈춤
    },
    onQuit: () => world.raid.abort(),
    onZoom: (dir) => raidZoom.step(dir), // 습격 화면 확대 단추 (두 손가락 · 휠도 됨, raid/raidZoom.js)
    onZoomReset: () => raidZoom.reset(),
  });

  const result = createResultScreen(uiRoot, {
    sound: (name) => sounds.play(name),
    onLair: () => showLair(),
    onAgain: () => {
      const design = bestiary.get(state.designId);
      if (design) startRaid(design, state.townId);
      else showLair();
    },
  });

  const editor = createEditorScreen({
    bestiary,
    saveStore,
    root: uiRoot,
    preview3d: (box) => createMonsterPreview(box),
    partSlots: () => gs.mods().partSlots, // 연구실 3단계 · 악명 단계 덤으로 늘어남
    onDone: (saved) => {
      showLair();
      if (saved) toast(TEXT.saved(saved.name), { kind: 'good' });
    },
  });

  // ── 3D 세상 (떠오르는 글자는 정보판 안의 상자에 띄움) ──
  const world = createGameWorld({ container, events, saveStore, floatLayer: hud.floatLayer });
  const { raid, stage } = world;
  const raidZoom = createRaidZoom(stage.renderer.domElement, stage.view, { onChange: (level) => hud.setZoomLevel(level) });
  hud.setZoomLevel(raidZoom.level);

  screens
    .add('lair', lair.screen)
    .add('shop', shop)
    .add('raid', hud)
    .add('editor', { show: (design) => editor.open(design ?? null), hide: () => editor.close() })
    .add('result', { el: result.el, overlay: true, show: (args) => result.show(...(args ?? [])), hide: result.hide });
  screens.onChange((name, previous) => {
    state.screen = name;
    if (previous && previous !== 'boot' && name !== previous) sounds.play('open');
  });

  // ── 소리 (녹화 모드에서는 끔) ──
  if (!capture) {
    connectVillainSounds(events, sounds);
    bindSoundButtons(sounds);
  }

  // ── 판이 끝나면: 악명 · 마을별 승리 · 부순 블록을 한 번만 기록 (돈은 습격 감독이 이미 넣음) ──
  events.on('raidEnded', ({ result: res } = {}) => {
    resultDue = true;
    if (!res || lastRaid?.result === res) return;
    const rankBefore = gs.rank().rank;
    saveStore.update((s) => recordRaid(s, res, { townId: res.townId, notoriety: res.notoriety }));
    const save = saveStore.getSave();
    const rankUp = gs.rankUpInfo(rankBefore, gs.rank().rank);
    const next = nextRank(save.notoriety);
    lastRaid = { result: res, rankUp, fame: { gained: res.notoriety ?? 0, nextName: next ? next.name : null, left: next ? next.at - save.notoriety : 0 } };
    if (rankUp) lair.queueRankUp(rankUp);
  });
  stage.onResize(() => fitCamera());

  // 정보판이 가리는 만큼 비켜서 마을이 보이게
  function fitCamera() {
    stage.view.setInsets(hud.getInsets());
  }

  // ── 돈이 다 떨어졌을 때: 어떤 괴수도 보낼 수 없으면 가장 싼 기본 괴수 값만큼 채워 줌 (게임이 막히지 않게) ──
  function rescueIfBroke() {
    const designs = bestiary.list();
    if (!designs.length) return;
    const money = saveStore.getSave().money;
    if (money >= gs.cheapestCost()) return;
    const builtIns = designs.filter((d) => d.builtIn).map(gs.costOf);
    const need = Math.min(...(builtIns.length ? builtIns : designs.map(gs.costOf)));
    if (!(need > money)) return;
    const saved = saveStore.update((s) => {
      s.money = need;
    });
    events.emit('moneyChanged', { money: saved.money, delta: need - money });
    toast(TEXT.rescue(need - money), { kind: 'good' });
  }

  // ── 화면 바꾸기 ──
  function showLair() {
    if (raid.state.phase !== 'idle') raid.clear(); // 괴수·영웅 치우기 (마을은 다음 출동 때 새로 지음)
    resultDue = false;
    state.paused = false;
    rescueIfBroke();
    screens.show('lair');
  }

  function openEditor(design) {
    screens.show('editor', design ?? null);
  }

  // ── 출동 (마을 지도에서 마을 + 괴수를 고름) ──
  function startRaid(design, townId = state.townId) {
    if (!design) {
      toast(TEXT.noMonster, { kind: 'bad' });
      return false;
    }
    const check = bestiary.validate(design);
    if (!check.ok) {
      toast(check.message, { kind: 'bad' });
      return false;
    }
    const town = getTown(townId);
    if (!gs.isTownOpen(town.id)) {
      toast(lockText(town.unlockRank, RANKS), { kind: 'bad' });
      sounds.play('nope');
      return false;
    }
    const mods = gs.mods();
    const sent = gs.fitDesign(design); // 부품 칸이 줄었으면 앞에서부터 칸 수만큼만
    const cost = gs.costOf(design);
    if (saveStore.getSave().money < cost) {
      toast(TEXT.poor(cost), { kind: 'bad' });
      sounds.play('nope');
      return false;
    }
    world.reset(town.id); // 마을·잔해·효과를 모두 새것으로 (다른 마을이면 그 마을로 다시 지음)
    document.querySelector('.vt-toast')?.classList.remove('is-on'); // 소굴에서 뜬 알림이 습격 화면까지 따라오지 않게
    resultDue = false;
    state.paused = false;
    state.designId = design.id;
    state.townId = town.id;
    lair.setLastDesign(design.id);
    const heroStats = VILLAIN.heroes[town.hero] ?? VILLAIN.hero;
    screens.show('raid', { name: design.name, thumb: thumbOf(design), heroName: heroStats.name, heroKind: town.hero, heroAt: heroStats.appearAtDestroyed });
    hud.setSpeed(state.speed);
    fitCamera();
    const started = raid.start(sent, { town: town.id, mods });
    if (!started.ok) {
      toast(started.message || TEXT.noMonster, { kind: 'bad' });
      showLair();
      return false;
    }
    hud.setHero({ heroName: raid.state.heroName, heroKind: raid.state.heroKind, heroAt: raid.state.heroAt }); // 감시탑으로 늦춰진 지점
    stage.view.snap();
    sounds.play('launch');
    hud.sync(raid);
    return true;
  }

  function showResult() {
    resultDue = false;
    const design = raid.design || bestiary.get(state.designId);
    const fresh = bestiary.get(state.designId); // 다시 보낼 때의 값 (그 사이 지워졌으면 이번 값)
    const res = raid.result;
    const info = lastRaid?.result === res ? lastRaid : {};
    hud.sync(raid);
    screens.show('result', [
      res,
      {
        money: saveStore.getSave().money,
        name: design?.name ?? '괴수',
        thumb: design ? thumbOf(design) : '',
        againCost: fresh ? gs.costOf(fresh) : res?.cost,
        fame: info.fame,
        rankUp: info.rankUp,
      },
    ]);
  }

  // ── 매 장면 ──
  const in3d = () => state.screen === 'raid' || state.screen === 'result';

  function update(dt) {
    if (state.screen === 'lair') lair.update(dt); // 녹화(수동) 모드일 때만 실제로 움직임
    if (!in3d()) return;
    world.update(dt, state.paused ? 0 : state.speed);
    hud.sync(raid); // 결과 화면 뒤에서도 번 돈 숫자가 끝까지 따라 올라가게
    if (state.screen === 'raid' && resultDue) showResult();
  }

  function render() {
    if (in3d()) world.render();
    else if (state.screen === 'lair') lair.render();
  }

  showLair();

  // ── 시험 · 디버그 도구 ──
  const pickDesign = (designId) => (typeof designId === 'string' ? bestiary.get(designId) : designId ?? bestiary.list()[0]);
  const setSaveValue = (fn) => {
    saveStore.update(fn);
    if (state.screen === 'lair') lair.refresh();
  };

  return {
    update,
    render,
    debug: {
      state,
      saveStore,
      bestiary,
      raid,
      get town() {
        return world.town; // 마을이 바뀌어도 늘 지금 마을
      },
      screens,
      events,
      stage,
      world,
      hud,
      editor,
      sounds,
      gameState: gs,
      lair: {
        place: (type, x, y) => lair.actions.build(type, x, y),
        upgrade: (id) => lair.actions.upgrade(id),
        move: (id, x, y) => lair.actions.move(id, x, y),
        sell: (id) => lair.actions.sell(id),
        claim: (key) => lair.actions.claim(key),
        spot: (type, near) => lair.actions.spot(type, near),
        check: (type) => lair.actions.check(type),
        evaluate: () => gs.evaluation(),
        refresh: () => lair.refresh(),
        view: lair.view,
        screen: lair.ui,
      },
      mods: () => gs.mods(),
      setNotoriety: (n) => setSaveValue((s) => void (s.notoriety = Math.max(0, Math.round(n)))),
      setMoney: (n) => setSaveValue((s) => void (s.money = Math.max(0, Math.round(n)))),
      startRaid: (designId, townId) => startRaid(pickDesign(designId), townId ?? state.townId),
      openEditor: (designId) => openEditor(typeof designId === 'string' ? bestiary.get(designId) : designId ?? null),
      showLair,
    },
  };
}
