// 성 지키기: 게임 전체 진행
// 각 모듈을 만들고 연결한 뒤, 게임 순서(준비 → 웨이브 → 쉬는 시간 → … → 승리/패배)를 진행합니다.
// 게임 규칙 숫자는 gameConfig.js, 각 부품의 동작은 systems/ 안의 파일을 보면 됩니다.
//
// 진행 단계 (phase)
//   'title'    처음 화면 (뒤에서 성이 쌓이는 중)
//   'break'    웨이브 사이 쉬는 시간 (타워를 지을 수 있음)
//   'wave'     몬스터가 몰려오는 중
//   'gameover' 성이 무너짐
//   'victory'  모든 웨이브를 막음

import { GAME } from './gameConfig.js';
import { createEvents } from './core/events.js';
import { createArenaStage } from './core/arenaStage.js';
import { createGameCamera } from './core/gameCamera.js';
import { createDebris } from './core/debris.js';
import { createArtLibrary, ART_ROLES } from './core/artLibrary.js';
import { createEconomy } from './systems/economy.js';
import { createCastle } from './systems/castle.js';
import { createEnemyManager } from './systems/enemies.js';
import { createTowerManager } from './systems/towers.js';
import { createProjectileManager } from './systems/projectiles.js';
import { createWaveDirector } from './systems/waves.js';
import { createCastleGuard } from './systems/castleGuard.js';
import { createArenaDecor } from './art/arenaDecor.js';
import { createGameSounds, connectGameSounds } from './audio/gameSounds.js';
import { createHud } from './ui/hud.js';
import { createBuildMenu } from './ui/buildMenu.js';
import { createOverlays } from './ui/overlays.js';
import { createArtUpload } from './ui/artUpload.js';

export async function createGame({ container }) {
  const events = createEvents();
  const stage = createArenaStage(container, GAME);
  const view = createGameCamera(stage.camera, stage.renderer.domElement, GAME.camera);
  const art = await createArtLibrary();
  const debris = createDebris(stage.scene, GAME.debris);
  const economy = createEconomy(events, GAME.economy);
  const castle = createCastle({ scene: stage.scene, events, debris, art, config: GAME });
  const enemies = createEnemyManager({ scene: stage.scene, events, debris, castle, art, config: GAME });
  const projectiles = createProjectileManager({ scene: stage.scene, events, enemies, debris, config: GAME });
  const towers = createTowerManager({ scene: stage.scene, events, enemies, projectiles, debris, art, config: GAME });
  const waves = createWaveDirector({ events, enemies, art, config: GAME });
  const guard = createCastleGuard({ castle, enemies, projectiles, config: GAME });
  const decor = createArenaDecor({ scene: stage.scene, events, config: GAME });
  const sounds = createGameSounds();
  connectGameSounds(events, sounds);

  const state = {
    phase: 'title',
    wave: 0, // 마지막으로 시작한 웨이브 번호
    breakLeft: 0, // 다음 웨이브까지 남은 시간
    speedIndex: 0,
    paused: false,
    kills: 0,
    selectedPad: null,
  };
  const totalWaves = GAME.waves.list.length;

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
  });

  const menu = createBuildMenu({
    towerTypes: GAME.towers,
    onBuild: (typeId) => {
      if (state.selectedPad !== null && buyTower(state.selectedPad, typeId)) closeMenu();
    },
    onUpgrade: () => {
      const pad = state.selectedPad;
      const cost = pad === null ? null : towers.upgradeCost(pad);
      if (cost === null || !economy.spend(cost)) return;
      towers.upgrade(pad);
      closeMenu();
    },
    onSell: () => {
      const pad = state.selectedPad;
      if (pad === null) return;
      economy.earn(towers.sell(pad));
      closeMenu();
    },
    onClose: () => closeMenu(),
  });

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

  // ── 탭: 타워 자리를 누르면 메뉴 열기 ──
  view.onTap(({ point }) => {
    if (state.phase === 'gameover' || state.phase === 'victory' || state.phase === 'title') return;
    const pad = point ? towers.padAt(point) : null;
    if (pad === null) {
      closeMenu();
      return;
    }
    openMenu(pad);
  });

  function openMenu(pad) {
    state.selectedPad = pad;
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

  function closeMenu() {
    state.selectedPad = null;
    towers.highlight(null);
    menu.close();
  }

  // ── 소식 받기 ──
  events.on('goldChanged', ({ gold }) => {
    hud.setGold(gold);
    menu.setGold(gold);
  });
  events.on('enemyKilled', ({ gold, position }) => {
    state.kills += 1;
    economy.earn(gold);
    const screen = view.worldToScreen(position);
    if (screen.visible) hud.floatText(screen.x, screen.y, `+${gold}`, 'gold');
  });
  events.on('castleRepaired', ({ hp, maxHp }) => hud.setCastleHp(hp, maxHp));
  events.on('castleHit', ({ hp, maxHp }) => {
    hud.setCastleHp(hp, maxHp);
    view.shake(0.25);
  });
  events.on('castleDestroyed', () => {
    state.phase = 'gameover';
    closeMenu();
    castle.collapse();
    view.shake(1);
    setTimeout(() => overlays.showGameOver({ wave: state.wave, total: totalWaves, kills: state.kills }), 1600);
  });
  events.on('waveCleared', ({ wave }) => {
    if (state.phase !== 'wave') return;
    const bonus = GAME.economy.waveBonus + GAME.economy.waveBonusGrowth * wave;
    economy.earn(bonus);
    const repaired = castle.hp < castle.maxHp && wave < totalWaves;
    if (repaired) castle.repair(GAME.castle.repairPerWave);
    hud.toast(`웨이브 ${wave} 막았어요! 보너스 +${bonus}${repaired ? ' · 성 수리' : ''}`);
    if (wave >= totalWaves) {
      state.phase = 'victory';
      closeMenu();
      setTimeout(() => overlays.showVictory({ wave, total: totalWaves, kills: state.kills, hp: castle.hp }), 1200);
    } else {
      startBreak(GAME.waves.breakSeconds);
    }
  });

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

  function restart() {
    closeMenu();
    enemies.clear();
    projectiles.clear();
    towers.clear();
    debris.clear();
    waves.reset();
    guard.reset();
    economy.reset();
    castle.reset();
    Object.assign(state, { wave: 0, kills: 0 });
    startBreak(GAME.waves.firstBreakSeconds);
    hud.setWave(0, totalWaves);
    hud.setCastleHp(castle.hp, castle.maxHp);
  }

  // ── 매 장면마다 ──
  function update(realDt) {
    const dt = state.paused ? 0 : realDt * GAME.speedOptions[state.speedIndex];
    view.update(realDt);
    const yaw = view.yaw;

    if (state.phase === 'break' && castle.isBuilt) {
      state.breakLeft -= dt;
      hud.setNextWaveCountdown(Math.max(0, state.breakLeft));
      if (state.breakLeft <= 0) startNextWave();
    }

    castle.update(dt, { cameraYaw: yaw });
    if (state.phase === 'wave' || state.phase === 'break' || state.phase === 'gameover' || state.phase === 'victory') {
      waves.update(dt);
      enemies.update(dt, { cameraYaw: yaw });
      towers.update(dt, { cameraYaw: yaw });
      guard.update(dt);
      projectiles.update(dt);
    } else {
      towers.update(dt, { cameraYaw: yaw });
    }
    debris.update(dt);
    decor.update(dt);
    hud.setEnemiesLeft(enemies.aliveCount() + waves.remainingToSpawn());
    if (state.selectedPad !== null) menu.reposition(view.worldToScreen(towers.padInfo(state.selectedPad).position));
  }

  // ── 시작 ──
  hud.setGold(economy.gold);
  hud.setWave(0, totalWaves);
  hud.setCastleHp(castle.hp, castle.maxHp);
  hud.setSpeed(GAME.speedOptions[0]);
  hud.setSound(false);
  castle.build();
  overlays.showStart();

  return {
    update,
    render: stage.render,
    // 자동 테스트와 영상 녹화에서 쓰는 손잡이
    debug: { state, events, economy, castle, enemies, towers, waves, projectiles, debris, view, hud, menu, overlays, art,
      startGame, buyTower, startNextWave, openMenu, restart },
  };
}
