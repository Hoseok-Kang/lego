// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 화면 미리보기 (진짜 게임 js/villain/main.js 가 없을 때, 또는 주소 끝에 ?uidemo)
// 소굴 · 상점 · 그리기 화면은 진짜 저장 내용으로 움직이고, 습격만 '흉내'(3D 마을 없이 숫자만 흘러감)로 보여 줍니다.
// 화면 모듈을 어떻게 이어 붙이는지 보여 주는 본보기이기도 합니다. 게임이 완성되면 이 파일은 미리보기 용도로만 쓰입니다.
//
//   startDemo({ root }) → { screens, lair, shop, hud, result, sounds, events, refresh() }   (window.villainUi 로도 꺼내 볼 수 있음)
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { createEvents } from '../../game/core/events.js';
import { saveStore } from '../data/saveStore.js';
import { bestiary } from '../data/bestiary.js';
import { createEditorScreen } from '../draw/editorScreen.js';
import { designThumbURL } from '../draw/pixelThumb.js';
import { createVillainSounds, connectVillainSounds } from '../audio/villainSounds.js';
import { createScreens } from './screens.js';
import { createLairScreen } from './lairScreen.js';
import { createShopScreen } from './shopScreen.js';
import { createRaidHud } from './raidHud.js';
import { createResultScreen } from './resultScreen.js';
import { bindSoundButtons } from './soundToggle.js';
import { toast } from './uiKit.js';

export async function startDemo({ root = document.getElementById('ui') } = {}) {
  const events = createEvents();
  const sounds = createVillainSounds();
  connectVillainSounds(events, sounds);
  const screens = createScreens();

  // 블록 괴수 그림(3D)을 만들 수 있으면 쓰고, 안 되면 도트 그림으로
  let monsterView = null;
  try {
    monsterView = await import('../monster/monsterPreview.js');
  } catch {
    monsterView = null;
  }
  const thumbOf = (design) => {
    try {
      return monsterView?.renderThumb?.(design, { size: 224 }) || designThumbURL(design, 160);
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

  let lastDesign = null;
  let fake = null; // 흉내 습격

  const lair = createLairScreen(root, {
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
      if (copy) toast(`'${copy.name}' 괴수를 복사했어요`, { kind: 'good' });
    },
    onRemove: (design) => {
      bestiary.remove(design.id);
      lair.render(lairState());
    },
  });

  const shop = createShopScreen(root, {
    onBack: () => screens.show('lair', lairState()),
    onBuy: (type) => {
      const part = VILLAIN.parts.types[type];
      const save = saveStore.getSave();
      if (!part || save.ownedParts.includes(type) || save.money < part.price) return false;
      saveStore.update((s) => {
        s.money -= part.price;
        s.ownedParts.push(type);
      });
      sounds.play('buy');
      shop.render(shopState());
      return true;
    },
  });

  const hud = createRaidHud(root, {
    onSpeed: (scale) => {
      if (fake) fake.speed = scale;
    },
    onQuit: () => fake && endRaid(false, true),
  });

  const result = createResultScreen(root, {
    sound: (name) => sounds.play(name),
    onLair: () => screens.show('lair', lairState()),
    onAgain: () => lastDesign && startRaid(lastDesign),
  });

  const editor = createEditorScreen({
    bestiary,
    saveStore,
    root,
    preview3d: monsterView?.createMonsterPreview ? (box) => monsterView.createMonsterPreview(box) : undefined,
    onDone: () => screens.show('lair', lairState()),
  });

  screens.add('lair', lair).add('shop', shop).add('raid', hud).add('result', { ...result, overlay: true });
  screens.add('editor', { show: (design) => editor.open(design ?? null), hide: () => editor.close() });
  screens.onChange((name, previous) => {
    if (previous && name !== previous) sounds.play('open');
  });
  const soundToggle = bindSoundButtons(sounds);

  function openEditor(design) {
    screens.show('editor', design);
  }

  // ── 흉내 습격: 숫자만 흘러가는 짧은 연극 ──
  function startRaid(design) {
    const cost = bestiary.designCost(design);
    if (saveStore.getSave().money < cost) return;
    saveStore.update((s) => {
      s.money -= cost;
    });
    lastDesign = design;
    const blocks = bestiary.countBlocks(design);
    const maxHp = blocks * VILLAIN.monster.hpPerBlock;
    fake = { design, cost, time: 0, phase: 'building', ratio: 0, blocksPaid: 0, hp: maxHp, maxHp, heroHp: VILLAIN.hero.maxHp, alertLeft: 0, cleanupLeft: 0, speed: hud.speed, last: performance.now(), stepAt: 0 };
    hud.setSpeed(hud.speed);
    screens.show('raid', { name: design.name, thumb: thumbOf(design) });
    events.emit('raidStarted', { design, cost });
    requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!fake) return;
    const dt = Math.min(0.05, (now - fake.last) / 1000) * fake.speed;
    fake.last = now;
    fake.time += dt;
    const f = fake;
    const strength = 0.03 + f.maxHp / 9000; // 큰 괴수일수록 빨리 부숨
    if (f.phase === 'building') {
      events.emit('buildTick', {});
      if (f.time > VILLAIN.monster.buildSeconds) {
        f.phase = 'smashing';
        events.emit('monsterBuilt', {});
      }
    } else if (f.phase === 'smashing' || f.phase === 'duel' || f.phase === 'cleanup' || f.phase === 'alert') {
      if (f.phase !== 'duel') {
        const before = Math.floor(f.ratio * 1400);
        f.ratio = Math.min(1, f.ratio + dt * strength * (f.phase === 'cleanup' ? 3 : 1));
        const broken = Math.floor(f.ratio * 1400) - before;
        if (broken > 0) {
          f.blocksPaid += broken;
          events.emit('blocksBroken', { count: broken, source: 'building' });
        }
        if (now > f.stepAt) {
          f.stepAt = now + 380 / f.speed;
          events.emit(Math.random() < 0.4 ? 'attack' : 'monsterStep', { kind: 'claw' });
        }
      }
      if (f.phase === 'smashing' && f.ratio >= VILLAIN.hero.appearAtDestroyed) {
        f.phase = 'alert';
        f.alertLeft = VILLAIN.hero.alertSeconds;
        events.emit('heroAlert', {});
      } else if (f.phase === 'alert') {
        f.alertLeft -= dt;
        if (f.alertLeft <= 0) {
          f.phase = 'duel';
          events.emit('heroLanded', {});
        }
      } else if (f.phase === 'duel') {
        f.hp -= dt * 55;
        f.heroHp -= dt * (14 + f.maxHp / 22);
        if (now > f.stepAt) {
          f.stepAt = now + 420 / f.speed;
          events.emit('attack', { kind: Math.random() < 0.5 ? 'sword' : 'claw' });
          events.emit('hit', { target: { team: Math.random() < 0.5 ? 'villain' : 'town' } });
        }
        if (f.hp <= 0) {
          events.emit('monsterPopped', {});
          return endRaid(false, false);
        }
        if (f.heroHp <= 0) {
          f.heroHp = 0;
          f.phase = 'cleanup';
          f.cleanupLeft = 8;
          events.emit('heroPopped', {});
        }
      } else if (f.phase === 'cleanup') {
        f.cleanupLeft -= dt;
        if (f.ratio >= 1 || f.cleanupLeft <= 0) return endRaid(true, false);
      }
    }
    hud.update({
      earned: f.blocksPaid * VILLAIN.town.payPerBlock,
      destroyedRatio: f.ratio,
      phase: f.phase,
      cleanupLeft: f.cleanupLeft,
      monsterHp: Math.max(0, f.hp),
      monsterMaxHp: f.maxHp,
      heroHp: f.heroHp,
      heroMaxHp: VILLAIN.hero.maxHp,
      heroVisible: f.phase === 'duel' || f.phase === 'cleanup',
    });
    requestAnimationFrame(tick);
  }

  function endRaid(win, aborted) {
    const f = fake;
    fake = null;
    if (!f) return;
    const bonuses = [{ id: 'blocks', label: `부순 블록 ${f.blocksPaid}개`, amount: f.blocksPaid * VILLAIN.town.payPerBlock }];
    if (win) {
      bonuses.push({ id: 'hero', label: `${VILLAIN.hero.name} 격파`, amount: VILLAIN.hero.payForWin });
      if (f.ratio >= 1) bonuses.push({ id: 'clear', label: '마을 싹쓸이', amount: VILLAIN.town.clearBonus });
    }
    let earned = bonuses.reduce((sum, b) => sum + b.amount, 0);
    if (earned < VILLAIN.economy.minPay) {
      bonuses.push({ id: 'minPay', label: '수고비', amount: VILLAIN.economy.minPay - earned });
      earned = VILLAIN.economy.minPay;
    }
    const raidResult = { win, aborted, earned, destroyedPercent: f.ratio * 100, time: f.time, bonuses, cost: f.cost };
    const save = saveStore.update((s) => {
      s.money += earned;
      s.stats.raids += 1;
      if (win) s.stats.wins += 1;
      s.stats.bestPay = Math.max(s.stats.bestPay || 0, earned);
    });
    events.emit('raidEnded', { result: raidResult });
    setTimeout(() => screens.show('result', [raidResult, { money: save.money, name: f.design.name, thumb: thumbOf(f.design), againCost: f.cost }]), aborted ? 0 : 900);
  }

  // 결과 화면은 값 두 개(result, info)를 받으므로 한 번 감싸 줌
  const showResult = result.show;
  screens.add('result', { el: result.el, overlay: true, show: (args) => showResult(...(args ?? [])), hide: result.hide });

  document.getElementById('stage')?.classList.add('is-demo');
  screens.show('lair', lairState());

  const api = { screens, lair, shop, hud, result, editor, sounds, soundToggle, events, refresh: () => lair.render(lairState()), startRaid, endRaid, get fake() { return fake; } };
  window.villainUi = api;
  return api;
}
