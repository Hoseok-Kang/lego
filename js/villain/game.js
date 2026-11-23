// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 게임 본체 (모든 부품을 이어 붙이는 곳)
// 화면 흐름:  소굴 ⇄ 괴수 그리기,  소굴 ⇄ 부품 상점,  소굴 → 습격 → 결과 → 소굴 (또는 다시 출동)
// 3D 세상(마을·괴수·영웅)은 gameWorld.js, 화면들은 ui/*.js, 그리기는 draw/*.js 가 만들고, 여기서는 서로 연결만 합니다.
//
//   const game = createVillainGame({ container, uiRoot, capture })
//       container: 3D 마을을 그릴 상자 (#stage),  uiRoot: 화면을 넣을 상자 (#ui),  capture: 영상 녹화 모드 (소리 없음)
//   game.update(dt)   한 장면 움직이기 (습격·결과 화면일 때만 3D 가 움직임)
//   game.render()     한 장면 그리기 (소굴·상점·그리기 화면에서는 3D 를 가리므로 그리지 않음)
//   game.debug        시험·디버그용 → main.js 가 window.villain 으로 내놓음
//       { state, saveStore, bestiary, raid, town, screens, events, stage, world, hud, editor, sounds,
//         startRaid(designId), openEditor(designId?), showLair() }
//       state: { screen, speed, paused, designId }
//
// 돈이 다 떨어졌을 때의 '악당 지원금' 규칙은 아래 rescueIfBroke 에 있습니다.
// 게임 숫자는 villainConfig.js, 화면 글자는 각 화면 파일에서 바꿉니다. 이 파일의 글자는 아래 TEXT.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from './villainConfig.js';
import { createEvents } from '../game/core/events.js';
import { saveStore } from './data/saveStore.js';
import { bestiary } from './data/bestiary.js';
import { createEditorScreen } from './draw/editorScreen.js';
import { designThumbURL } from './draw/pixelThumb.js';
import { createMonsterPreview, renderThumb } from './monster/monsterPreview.js';
import { createVillainSounds, connectVillainSounds } from './audio/villainSounds.js';
import { createScreens } from './ui/screens.js';
import { createLairScreen } from './ui/lairScreen.js';
import { createShopScreen } from './ui/shopScreen.js';
import { createRaidHud } from './ui/raidHud.js';
import { createResultScreen } from './ui/resultScreen.js';
import { bindSoundButtons } from './ui/soundToggle.js';
import { toast } from './ui/uiKit.js';
import { createGameWorld } from './gameWorld.js';

const TEXT = {
  copied: (name) => `'${name}' 괴수를 복사했어요`,
  saved: (name) => `'${name}' 괴수를 도감에 넣었어요`,
  removed: '괴수를 지웠어요',
  rescue: (amount) => `돈이 다 떨어져서 악당 협회가 지원금 ${amount}원을 줬어요`,
  noMonster: '출동할 괴수를 찾지 못했어요',
  keepMoney: (amount) => `괴수를 보낼 돈 ${amount}원은 남겨 둬야 해요. 조금 더 벌고 와요`,
};

export function createVillainGame({ container, uiRoot, capture = false }) {
  const events = createEvents();
  const sounds = createVillainSounds();
  const screens = createScreens();
  const state = { screen: 'boot', speed: 1, paused: false, designId: null };
  let resultDue = false; // 판이 끝나서 결과 화면을 띄울 차례

  // ── 괴수 카드 그림 (블록 괴수 그림이 안 되면 도트 그림으로) ──
  const thumbOf = (design) => {
    try {
      return renderThumb(design, { size: 224 }) || designThumbURL(design, 160);
    } catch {
      return designThumbURL(design, 160);
    }
  };

  const lairState = () => {
    const save = saveStore.getSave();
    return { money: save.money, designs: bestiary.list(), stats: save.stats };
  };
  const shopState = () => {
    const save = saveStore.getSave();
    return { money: save.money, ownedParts: save.ownedParts };
  };

  // ── 화면들 ──
  const lair = createLairScreen(uiRoot, {
    costOf: bestiary.designCost,
    blocksOf: bestiary.countBlocks,
    thumbOf,
    onRaid: (design) => startRaid(design),
    onEdit: (design) => openEditor(design),
    onNew: () => openEditor(null),
    onShop: () => screens.show('shop', shopState()),
    onCopy: (design) => {
      const copy = bestiary.duplicate(design.id);
      lair.render(lairState());
      if (copy) toast(TEXT.copied(copy.name), { kind: 'good' });
    },
    onRemove: (design) => {
      if (bestiary.remove(design.id)) toast(TEXT.removed);
      lair.render(lairState());
    },
  });

  const shop = createShopScreen(uiRoot, {
    onBack: () => showLair(),
    onBuy: (type) => {
      const part = VILLAIN.parts.types[type];
      const save = saveStore.getSave();
      if (!part || save.ownedParts.includes(type) || save.money < part.price) return false;
      // 가장 싼 괴수를 보낼 돈은 남겨 둠 (다 쓰고 지원금을 받아 부품을 거의 공짜로 사는 일을 막음)
      const keep = Math.min(...bestiary.list().map((d) => bestiary.designCost(d)));
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
  });

  const result = createResultScreen(uiRoot, {
    sound: (name) => sounds.play(name),
    onLair: () => showLair(),
    onAgain: () => {
      const design = bestiary.get(state.designId);
      if (design) startRaid(design);
      else showLair();
    },
  });

  const editor = createEditorScreen({
    bestiary,
    saveStore,
    root: uiRoot,
    preview3d: (box) => createMonsterPreview(box),
    onDone: (saved) => {
      showLair();
      if (saved) toast(TEXT.saved(saved.name), { kind: 'good' });
    },
  });

  // ── 3D 세상 (떠오르는 글자는 정보판 안의 상자에 띄움) ──
  const world = createGameWorld({ container, events, saveStore, floatLayer: hud.floatLayer });
  const { raid, stage } = world;

  screens
    .add('lair', lair)
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

  // ── 소식 듣기 ──
  events.on('raidEnded', () => {
    resultDue = true;
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
    const costs = designs.map((d) => bestiary.designCost(d));
    if (money >= Math.min(...costs)) return;
    const builtIns = designs.filter((d) => d.builtIn).map((d) => bestiary.designCost(d));
    const need = Math.min(...(builtIns.length ? builtIns : costs));
    if (need <= money) return;
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
    screens.show('lair', lairState());
  }

  function openEditor(design) {
    screens.show('editor', design ?? null);
  }

  // ── 출동 ──
  function startRaid(design) {
    if (!design) {
      toast(TEXT.noMonster, { kind: 'bad' });
      return false;
    }
    const check = bestiary.validate(design);
    if (!check.ok) {
      toast(check.message, { kind: 'bad' });
      return false;
    }
    if (saveStore.getSave().money < bestiary.designCost(design)) {
      toast(`돈이 모자라요 (${bestiary.designCost(design)}원 필요)`, { kind: 'bad' });
      sounds.play('nope');
      return false;
    }
    world.reset(); // 마을·잔해·효과를 모두 새것으로
    document.querySelector('.vt-toast')?.classList.remove('is-on'); // 소굴에서 뜬 알림이 습격 화면까지 따라오지 않게
    resultDue = false;
    state.paused = false;
    state.designId = design.id;
    screens.show('raid', { name: design.name, thumb: thumbOf(design) });
    hud.setSpeed(state.speed);
    fitCamera();
    const started = raid.start(design);
    if (!started.ok) {
      toast(started.message || TEXT.noMonster, { kind: 'bad' });
      showLair();
      return false;
    }
    stage.view.snap();
    sounds.play('launch');
    hud.sync(raid);
    return true;
  }

  function showResult() {
    resultDue = false;
    const design = raid.design || bestiary.get(state.designId);
    const fresh = bestiary.get(state.designId); // 다시 보낼 때의 값 (그 사이 지워졌으면 이번 값)
    hud.sync(raid);
    screens.show('result', [
      raid.result,
      {
        money: saveStore.getSave().money,
        name: design?.name ?? '괴수',
        thumb: design ? thumbOf(design) : '',
        againCost: fresh ? bestiary.designCost(fresh) : raid.result?.cost,
      },
    ]);
  }

  // ── 매 장면 ──
  const in3d = () => state.screen === 'raid' || state.screen === 'result';

  function update(dt) {
    if (!in3d()) return;
    world.update(dt, state.paused ? 0 : state.speed);
    hud.sync(raid); // 결과 화면 뒤에서도 번 돈 숫자가 끝까지 따라 올라가게
    if (state.screen === 'raid' && resultDue) showResult();
  }

  function render() {
    if (in3d()) world.render();
  }

  showLair();

  return {
    update,
    render,
    debug: {
      state,
      saveStore,
      bestiary,
      raid,
      town: world.town,
      screens,
      events,
      stage,
      world,
      hud,
      lair,
      editor,
      sounds,
      startRaid: (designId) => startRaid(typeof designId === 'string' ? bestiary.get(designId) : designId ?? bestiary.list()[0]),
      openEditor: (designId) => openEditor(typeof designId === 'string' ? bestiary.get(designId) : designId ?? null),
      showLair,
    },
  };
}
