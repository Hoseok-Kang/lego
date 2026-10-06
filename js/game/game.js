// 성 지키기: 게임 전체 진행
// 각 모듈을 만들고 연결한 뒤, 게임 순서(준비 → 웨이브 → 보상 카드 → 쉬는 시간 → … → 승리/패배)를 진행합니다.
// 게임 규칙 숫자는 gameConfig.js, 각 부품의 동작은 systems/ 안의 파일을 보면 됩니다.
//
// 진행 단계 (phase)
//   'title'    처음 화면 (뒤에서 성이 쌓이는 중)
//   'break'    웨이브 사이 쉬는 시간 (타워·성 부품을 지을 수 있음)
//   'wave'     몬스터가 몰려오는 중
//   'reward'   웨이브를 막고 보상 카드를 고르는 중 (땅도 이때 넓어짐)
//   'gameover' 성이 무너짐
//   'victory'  모든 웨이브를 막음

import { GAME } from './gameConfig.js';
import { createEvents } from './core/events.js';
import { createArenaStage } from './core/arenaStage.js';
import { createGameCamera } from './core/gameCamera.js';
import { createDebris } from './core/debris.js';
import { createArtLibrary, ART_ROLES } from './core/artLibrary.js';
import { createModifiers } from './core/modifiers.js';
import { createEconomy } from './systems/economy.js';
import { createLand } from './systems/land.js';
import { createCastle } from './systems/castle.js';
import { createCastleParts } from './systems/castleParts.js';
import { createEnemyManager } from './systems/enemies.js';
import { createTowerManager } from './systems/towers.js';
import { createProjectileManager } from './systems/projectiles.js';
import { createWaveDirector } from './systems/waves.js';
import { createCastleGuard } from './systems/castleGuard.js';
import { createBossAssembly } from './systems/bossAssembly.js';
import { createCardDeck } from './systems/cards.js';
import { createSkills } from './systems/skills.js';
import { createArenaDecor } from './art/arenaDecor.js';
import { createGameSounds, connectGameSounds } from './audio/gameSounds.js';
import { createHud } from './ui/hud.js';
import { createBuildMenu } from './ui/buildMenu.js';
import { createCardPicker } from './ui/cardPicker.js';
import { createOverlays } from './ui/overlays.js';
import { createArtUpload } from './ui/artUpload.js';

export async function createGame({ container }) {
  const events = createEvents();
  const stage = createArenaStage(container, GAME);
  const view = createGameCamera(stage.camera, stage.renderer.domElement, GAME.camera);
  const art = await createArtLibrary();
  const modifiers = createModifiers();
  const scene = stage.scene;
  const debris = createDebris(scene, GAME.debris);
  const economy = createEconomy(events, GAME.economy);
  const land = createLand({ scene, stage, events, config: GAME });
  const castle = createCastle({ scene, events, debris, art, config: GAME });
  // 몬스터는 타워 자리를 피해 다니므로 타워 관리자를 나중에 연결함
  let towers = null;
  const enemies = createEnemyManager({
    scene,
    events,
    debris,
    castle,
    art,
    config: GAME,
    getSpawnRadius: () => land.spawnRadius,
    getPads: () => (towers ? towers.padPositions() : []),
  });
  const projectiles = createProjectileManager({ scene, events, enemies, debris, config: GAME });
  const castleParts = createCastleParts({ scene, events, castle, enemies, projectiles, debris, modifiers, config: GAME });
  towers = createTowerManager({
    scene,
    events,
    enemies,
    projectiles,
    debris,
    art,
    modifiers,
    config: GAME,
    getBuildSpeedBonus: () => castleParts.buildSpeedBonus(),
  });
  const waves = createWaveDirector({ events, enemies, art, config: GAME });
  const bossAssembly = createBossAssembly({ scene, events, debris, config: GAME });
  // 부서진 블록이 성 돌바닥·타워 자리 위에 떨어지면 그 위에 얹히도록 바닥 높이를 알려 줌
  let padCache = [];
  const platformHalf = GAME.castle.platformSize / 2;
  debris.setGroundHeight((x, z) => {
    const edge = Math.max(Math.abs(x), Math.abs(z));
    if (edge > land.size / 2) return -100; // 바닥판 밖: 책상에서 떨어지듯 아래로 떨어져 사라짐
    if (edge <= platformHalf) return 1;
    for (const pad of padCache) {
      const half = pad.size / 2;
      if (Math.abs(x - pad.x) <= half && Math.abs(z - pad.z) <= half) return 1;
    }
    return 0;
  });
  const guard = createCastleGuard({ castle, enemies, projectiles, modifiers, config: GAME });
  const deck = createCardDeck({ config: GAME });
  const skills = createSkills({ scene, events, enemies, castle, debris, modifiers, config: GAME });
  const decor = createArenaDecor({ scene, events, config: GAME, land });
  const sounds = createGameSounds();
  connectGameSounds(events, sounds);

  const state = {
    phase: 'title',
    wave: 0, // 마지막으로 시작한 웨이브 번호
    breakLeft: 0, // 다음 웨이브까지 남은 시간
    speedIndex: 0,
    paused: false,
    artOpen: false, // '내 그림' 창이 열려 있으면 게임을 잠깐 멈춤
    kills: 0,
    selected: null, // 메뉴가 열린 자리: { kind: 'pad' | 'socket', index }
    upgradeHints: 0, // '타워를 눌러 강화해 보세요' 안내를 보여 준 횟수
    hintCheck: 0,
    offeredCards: [],
  };
  const totalWaves = GAME.waves.list.length;
  const timers = new Set(); // 다시 하기를 누르면 취소할 예약들

  // ── 화면 (HUD, 메뉴, 안내창) ──
  const hud = createHud({
    onStartWave: () => {
      if (state.phase === 'break') state.breakLeft = 0;
    },
    onToggleSpeed: () => {
      state.speedIndex = (state.speedIndex + 1) % GAME.speedOptions.length;
      hud.setSpeed(GAME.speedOptions[state.speedIndex]);
    },
    onTogglePause: () => {
      state.paused = !state.paused;
      hud.setPaused(state.paused);
    },
    onToggleSound: () => hud.setSound(sounds.setEnabled(!sounds.isEnabled())),
    onOpenArt: () => artUpload.open(),
    onSkill: (id) => useSkill(id),
  });

  const menu = createBuildMenu({
    towerTypes: GAME.towers,
    onBuild: (typeId) => {
      if (state.selected?.kind === 'pad' && buyTower(state.selected.index, typeId)) closeMenu();
    },
    onUpgrade: () => {
      if (state.selected?.kind !== 'pad') return;
      const pad = state.selected.index;
      const cost = towers.upgradeCost(pad);
      if (cost === null || !economy.spend(cost)) return;
      towers.upgrade(pad);
      closeMenu();
    },
    onSell: () => {
      if (state.selected?.kind !== 'pad') return;
      economy.earn(towers.sell(state.selected.index));
      closeMenu();
    },
    onBuildPart: (typeId) => {
      if (state.selected?.kind === 'socket' && buyPart(state.selected.index, typeId)) closeMenu();
    },
    onUpgradePart: () => {
      if (state.selected?.kind !== 'socket') return;
      const socket = state.selected.index;
      const cost = castleParts.upgradeCost(socket);
      if (cost === null || !economy.spend(cost)) return;
      castleParts.upgrade(socket);
      closeMenu();
    },
    onClose: () => closeMenu(),
  });

  const cardPicker = createCardPicker({ onPick: (cardId) => pickCard(cardId) });

  const overlays = createOverlays({
    onStart: () => startGame(),
    onRestart: () => {
      restart();
      overlays.hide();
    },
    onOpenArt: () => artUpload.open(),
  });

  const artUpload = createArtUpload({
    roles: ART_ROLES,
    onOpenChange: (open) => {
      state.artOpen = open;
    },
    hasCustom: (id) => art.hasCustom(id),
    onApply: async (roleId, image) => {
      await art.setCustom(roleId, image);
      refreshArt(roleId);
    },
    onReset: (roleId) => {
      art.resetCustom(roleId);
      refreshArt(roleId);
    },
  });

  // 그림이 바뀌면 그 그림을 쓰는 것만 다시 만듦
  function refreshArt(roleId) {
    if (roleId === 'castle') castle.refreshArt();
    else if (roleId.startsWith('tower:')) towers.refreshArt(roleId.slice(6));
    else if (roleId.startsWith('monster:')) enemies.refreshArt(roleId.slice(8));
    hud.toast('그림을 바꿨어요');
  }

  // ── 탭: 스킬 겨누기 → 성 부품 자리 → 타워 자리 ──
  view.onTap(({ point, clientX, clientY }) => {
    if (!['break', 'wave'].includes(state.phase)) return;
    if (skills.targeting) {
      if (point && skills.cast(skills.targeting, point)) hud.setSkills(skills.list());
      return;
    }
    const socket = point ? castleParts.socketAt(point) : null;
    if (socket !== null) {
      openSocketMenu(socket);
      return;
    }
    const pad = point ? towers.padAt(point) ?? nearestPadOnScreen(clientX, clientY) : null;
    if (pad !== null) {
      openMenu(pad);
      return;
    }
    closeMenu();
  });

  // 작은 화면에서 타워 자리를 살짝 빗나가게 눌러도 가장 가까운 자리를 골라 줌
  const PAD_TAP_PX = 28;
  function nearestPadOnScreen(clientX, clientY) {
    let best = null;
    let bestDistance = PAD_TAP_PX;
    padCache.forEach((pad, index) => {
      const screen = view.worldToScreen({ x: pad.x, y: 1, z: pad.z });
      const distance = Math.hypot(screen.x - clientX, screen.y - clientY);
      if (screen.visible && distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  }

  function openMenu(pad) {
    closeMenu();
    state.selected = { kind: 'pad', index: pad };
    towers.highlight(pad);
    const info = towers.padInfo(pad);
    const screen = view.worldToScreen(info.position);
    if (info.tower) {
      menu.openForTower({
        tower: info.tower,
        screen,
        gold: economy.gold,
        upgradeCost: towers.upgradeCost(pad),
        sellValue: towers.sellValue(pad),
      });
    } else {
      menu.openForPad({ screen, gold: economy.gold });
    }
  }

  function openSocketMenu(socket) {
    closeMenu();
    state.selected = { kind: 'socket', index: socket };
    castleParts.highlight(socket);
    const info = castleParts.socketInfo(socket);
    const screen = view.worldToScreen(info.position);
    if (info.part) {
      menu.openForPart({ part: info.part, screen, gold: economy.gold, upgradeCost: castleParts.upgradeCost(socket) });
    } else {
      menu.openForSocket({
        screen,
        gold: economy.gold,
        kindLabel: info.kind === 'corner' ? '성 모서리' : '성 옆면',
        options: castleParts.optionsFor(socket),
      });
    }
  }

  function refreshOpenMenu() {
    if (!state.selected || !menu.isOpen) return;
    const { kind, index } = state.selected;
    if (kind === 'pad') openMenu(index);
    else openSocketMenu(index);
  }

  function closeMenu() {
    state.selected = null;
    towers.highlight(null);
    castleParts.highlight(null);
    menu.close();
  }

  function selectedPosition() {
    const { kind, index } = state.selected;
    return kind === 'pad' ? towers.padInfo(index).position : castleParts.socketInfo(index).position;
  }

  // ── 스킬 ──
  function useSkill(id) {
    if (!['break', 'wave'].includes(state.phase)) return; // 카드를 고르는 중에는 스킬을 쓰지 않음
    const skill = skills.list().find((item) => item.id === id);
    if (!skill || !skill.unlocked) return;
    if (skill.needsTarget) {
      if (skills.targeting === id) skills.cancelTarget();
      else if (skill.ready) {
        closeMenu();
        skills.beginTarget(id);
      }
    } else {
      skills.cast(id);
    }
    hud.setSkills(skills.list());
  }

  // ── 소식 받기 ──
  events.on('goldChanged', ({ gold }) => {
    hud.setGold(gold);
    menu.setGold(gold);
  });
  events.on('enemyKilled', ({ gold, position }) => {
    state.kills += 1;
    const total = gold + modifiers.values.killGoldBonus;
    economy.earn(total);
    const screen = view.worldToScreen(position);
    if (screen.visible) hud.floatText(screen.x, screen.y, `+${total}`, 'gold');
  });
  events.on('castleRepaired', ({ hp, maxHp }) => hud.setCastleHp(hp, maxHp));
  events.on('castleHit', ({ hp, maxHp }) => {
    hud.setCastleHp(hp, maxHp);
    view.shake(0.25);
  });
  events.on('partBuilt', () => {
    hud.setCastleHp(castle.hp, castle.maxHp);
    refreshOpenMenu();
  });
  events.on('partUpgraded', () => hud.setCastleHp(castle.hp, castle.maxHp));
  // 메뉴를 연 채로 타워·부품이 다 지어지면 메뉴 내용(강화 가능 여부)을 새로 고침
  events.on('towerBuilt', () => refreshOpenMenu());
  events.on('towerBuildStarted', () => refreshOpenMenu());
  events.on('skillImpact', () => view.shake(0.7));
  // 대장 등장: 바닥에 남은 잔해가 모여서 대장이 됨
  events.on('enemySpawned', ({ enemy }) => {
    if (enemy?.typeId === 'boss') bossAssembly.start(enemy);
  });
  events.on('bossAssembling', ({ fromRubble }) => {
    hud.toast(fromRubble > 0 ? '대장 등장! 바닥에 떨어진 블록들이 모여들어요' : '대장 등장!');
    view.shake(0.3);
  });
  events.on('bossAssembled', () => view.shake(0.9));
  events.on('castleDestroyed', () => {
    state.phase = 'gameover';
    closeMenu();
    cardPicker.hide();
    skills.cancelTarget();
    castle.collapse();
    view.shake(1);
    later(1.6, () => overlays.showGameOver({ wave: state.wave, total: totalWaves, kills: state.kills }));
  });
  events.on('waveCleared', ({ wave }) => {
    if (state.phase !== 'wave') return;
    const values = modifiers.values;
    const interest = Math.floor(economy.gold * values.interestRate);
    const bonus =
      GAME.economy.waveBonus + GAME.economy.waveBonusGrowth * wave + values.waveGoldBonus + castleParts.waveGold() + interest;
    economy.earn(bonus);
    if (wave >= totalWaves) {
      state.phase = 'victory';
      closeMenu();
      skills.cancelTarget();
      hud.toast(`마지막 웨이브까지 막았어요! 보너스 +${bonus}`);
      later(1.2, () => overlays.showVictory({ wave, total: totalWaves, kills: state.kills, hp: castle.hp }));
      return;
    }
    const repairAmount = GAME.castle.repairPerWave + values.repairBonus + castleParts.repairBonus();
    const repaired = castle.hp < castle.maxHp;
    if (repaired) castle.repair(repairAmount);
    hud.toast(`웨이브 ${wave} 막았어요! 보너스 +${bonus}${repaired ? ' · 성 수리' : ''}`);
    land.grow();
    showRewardCards(wave);
  });
  events.on('landGrown', ({ size }) => {
    const added = towers.unlockRings(size);
    padCache = towers.padPositions();
    view.setFitRadius(size / 2 + GAME.camera.fitMargin);
    hud.setLand(size);
    if (added > 0) hud.toast(`땅이 넓어져서 새 타워 자리 ${added}개가 생겼어요`);
  });

  // ── 보상 카드 ──
  function showRewardCards(wave) {
    state.phase = 'reward';
    closeMenu();
    skills.cancelTarget();
    const unlockedSkills = skills.list().filter((item) => item.unlocked).map((item) => item.id);
    state.offeredCards = deck.draw(GAME.cards.choices, { unlockedSkills });
    if (state.offeredCards.length === 0) {
      startBreak(GAME.waves.breakSeconds);
      return;
    }
    cardPicker.show(state.offeredCards, { wave });
  }

  function pickCard(cardId) {
    if (state.phase !== 'reward') return false;
    const card = state.offeredCards.find((item) => item.id === cardId);
    if (!card) return false;
    deck.apply(card, { modifiers, economy, skills, castleParts });
    events.emit('cardPicked', { card });
    cardPicker.hide();
    hud.toast(`카드: ${card.name}`);
    hud.setSkills(skills.list());
    state.offeredCards = [];
    startBreak(GAME.waves.breakSeconds);
    return true;
  }

  function startGame({ sound = true } = {}) {
    if (state.phase !== 'title') return;
    if (sound) hud.setSound(sounds.setEnabled(true));
    startBreak(GAME.waves.firstBreakSeconds);
    overlays.hide();
  }

  // 돈을 내고 타워 짓기 (돈이 모자라거나 자리가 차 있으면 false)
  function buyTower(pad, typeId) {
    const type = GAME.towers[typeId];
    if (!type || towers.padInfo(pad).tower || !economy.spend(type.cost)) return false;
    towers.build(pad, typeId);
    return true;
  }

  // 돈을 내고 성 부품 붙이기
  function buyPart(socket, typeId) {
    const option = castleParts.optionsFor(socket).find((item) => item.typeId === typeId);
    if (!option || castleParts.socketInfo(socket).part || !economy.spend(option.cost)) return false;
    castleParts.build(socket, typeId);
    return true;
  }

  function startBreak(seconds) {
    state.phase = 'break';
    state.breakLeft = seconds;
    waves.preview(state.wave + 1); // 다음 웨이브가 올 방향을 바닥에 미리 표시
  }

  function startNextWave() {
    state.wave += 1;
    state.phase = 'wave';
    waves.start(state.wave);
    hud.setWave(state.wave, totalWaves);
    hud.setNextWaveCountdown(null);
  }

  // 강화할 돈이 모였는데 아직 강화를 안 했으면 알려 줌 (강화가 이기는 데 중요해서)
  const MAX_UPGRADE_HINTS = 2;
  function maybeHintUpgrade(realDt) {
    state.hintCheck -= realDt;
    if (state.upgradeHints >= MAX_UPGRADE_HINTS || state.hintCheck > 0) return;
    state.hintCheck = 1;
    for (let pad = 0; pad < padCache.length; pad++) {
      const info = towers.padInfo(pad);
      const cost = towers.upgradeCost(pad);
      if (info.tower && info.tower.level === 1 && cost !== null && cost <= economy.gold) {
        state.upgradeHints += 1;
        hud.toast('골드가 모였어요! 지은 타워를 누르면 강화할 수 있어요');
        return;
      }
    }
  }

  // 게임 시간으로 잠시 뒤에 할 일 (다시 하기를 누르면 취소됨)
  function later(seconds, action) {
    timers.add({ left: seconds, action });
  }

  function tickTimers(dt) {
    for (const timer of timers) {
      timer.left -= dt;
      if (timer.left <= 0) {
        timers.delete(timer);
        timer.action();
      }
    }
  }

  function restart() {
    closeMenu();
    timers.clear();
    cardPicker.hide();
    enemies.clear();
    projectiles.clear();
    bossAssembly.clear();
    towers.clear();
    castleParts.clear();
    debris.clear();
    waves.reset();
    guard.reset();
    skills.reset();
    deck.reset();
    modifiers.reset();
    economy.reset();
    land.reset();
    castle.reset();
    state.offeredCards = [];
    Object.assign(state, { wave: 0, kills: 0, speedIndex: 0, paused: false, upgradeHints: 0 });
    hud.setSpeed(GAME.speedOptions[0]);
    hud.setPaused(false);
    startBreak(GAME.waves.firstBreakSeconds);
    hud.setWave(0, totalWaves);
    hud.setCastleHp(castle.hp, castle.maxHp);
    hud.setSkills(skills.list());
  }

  // ── 매 장면마다 ──
  function update(realDt) {
    const frozen = state.paused || state.artOpen;
    const dt = frozen ? 0 : realDt * GAME.speedOptions[state.speedIndex];
    view.update(realDt);
    const yaw = view.yaw;
    tickTimers(frozen ? 0 : realDt);

    if (state.phase === 'break' && castle.isBuilt) {
      maybeHintUpgrade(realDt);
      state.breakLeft -= dt;
      hud.setNextWaveCountdown(Math.max(0, state.breakLeft));
      if (state.breakLeft <= 0) startNextWave();
    } else if (state.phase !== 'break') {
      hud.setNextWaveCountdown(null);
    }

    land.update(dt);
    castle.update(dt, { cameraYaw: yaw });
    castleParts.update(dt, { cameraYaw: yaw });
    if (state.phase !== 'title') {
      waves.update(dt);
      enemies.update(dt, { cameraYaw: yaw });
      guard.update(dt);
      projectiles.update(dt);
      skills.update(dt);
      bossAssembly.update(dt);
    }
    towers.update(dt, { cameraYaw: yaw });
    debris.update(dt);
    decor.update(dt);
    hud.setEnemiesLeft(enemies.aliveCount() + waves.remainingToSpawn());
    hud.setSkills(skills.list());
    if (state.selected) menu.reposition(view.worldToScreen(selectedPosition()));
  }

  // ── 시작 ──
  view.setFitRadius(land.size / 2 + GAME.camera.fitMargin, { instant: true });
  towers.unlockRings(land.size);
  padCache = towers.padPositions();
  hud.setGold(economy.gold);
  hud.setWave(0, totalWaves);
  hud.setCastleHp(castle.hp, castle.maxHp);
  hud.setSpeed(GAME.speedOptions[0]);
  hud.setSound(false);
  hud.setLand(land.size);
  hud.setSkills(skills.list());
  castle.build();
  overlays.showStart();

  return {
    update,
    render: stage.render,
    // 자동 테스트와 영상 녹화에서 쓰는 손잡이
    debug: {
      state,
      events,
      economy,
      castle,
      castleParts,
      enemies,
      towers,
      waves,
      projectiles,
      debris,
      bossAssembly,
      land,
      skills,
      deck,
      modifiers,
      view,
      hud,
      menu,
      cardPicker,
      overlays,
      art,
      startGame,
      buyTower,
      buyPart,
      pickCard,
      useSkill,
      startNextWave,
      openMenu,
      openSocketMenu,
      restart,
    },
  };
}
