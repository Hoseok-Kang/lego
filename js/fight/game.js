// 펑펑 토끼: 게임 전체 진행
// 싸움터(fightWorld.js)와 화면 위 글자·버튼(정보판, 안내창, 떠오르는 글자, 소리, 조작)을 만들어 연결하고,
// 게임 순서를 진행합니다.
//
// 진행 단계 (state.phase)
//   'title'   처음 화면 (뒤에서 토끼들이 숨 쉬는 중)
//   'play'    싸우는 중
//   'paused'  잠깐 멈춤 (Esc · P · 멈춤 단추, 창을 벗어나도 저절로 멈춤)
//   'won'     미친토끼를 모두 펑! → 잠깐 뒤 결과 화면
//   'lost'    내 토끼가 펑! → 잠깐 뒤 결과 화면
//
//   const game = createFightGame({ container, capture })   capture: 영상 녹화 모드 (소리 없음)
//   game.update(dt) ; game.render()                        매 장면 (main.js 가 부름)
//   game.debug = { state, stats, player, enemies, bullets, props, pickups, collision, input, view, fx, events,
//                  debris, stage, hud, overlays, floats, sounds,
//                  startGame(), restart(), pause(), resume(), setAutopilot(fn | null) }
//       setAutopilot(fn): 싸우는 동안 매 장면 내 토끼를 움직이기 전에 input.setOverride(fn(debug)) (null 이면 끝)
//
// 멈칫(hit-stop): 칼로 맞히거나 미친토끼가 펑 하면 아주 잠깐 시간이 멈춤 (최대 fightConfig.js 의 hitStopMax)
// 찾아오기: 깨어 있는 미친토끼가 하나도 없이 enemies.huntAfter 초가 지나면 가장 가까운 토끼가 내 토끼를 찾아옴
// 이긴 뒤('won')에는 아직 날아가던 적 총알이 내 토끼를 맞히지 않음 (결과 화면의 남은 체력 = 정보판 체력)
// 멈춘 동안에는 카메라가 멈추기 직전의 조준 쪽을 그대로 봄 (멈춤 화면 뒤에서 화면이 미끄러지지 않게)
// 휴대폰 터치 중이면 매 장면 카메라에 '화면 아래 조작 단추 높이'(fightConfig.js 의 camera.touchBottomPx)를 알려 줌
//   → 내 토끼가 단추 밑에 숨지 않게 카메라가 조금 더 따라감
// 처음 띄울 때 효과 셰이더를 미리 한 번 만들어 둠 (첫 총·첫 칼·첫 망치 때 멈칫하지 않게, 화면에는 남지 않음)
// 떠오르는 글자·당근 떨어뜨리기·기록 세기는 fightFeedback.js, 싸움터 부품 만들기·다시 차리기는 fightWorld.js
// 결과 화면이 뜨기까지의 시간 등 진행 느낌은 아래 상수에서 바꿉니다.

import { FIGHT } from './fightConfig.js';
import { createFightWorld } from './fightWorld.js';
import { createRoundStats, connectFightFeedback } from './fightFeedback.js';
import { createInput } from './core/input.js';
import { createHud } from './ui/hud.js';
import { createOverlays } from './ui/overlays.js';
import { createFloatText } from './ui/floatText.js';
import { createFightSounds, connectFightSounds } from './audio/fightSounds.js';

const MAX_STEP = 1 / 15; // 한 장면에 계산하는 최대 시간 (아주 느린 기기에서 한 번에 너무 멀리 움직이지 않게)
const END_DELAY = 1.6; // 마지막 '펑!' 뒤 결과 화면이 뜨기까지 (초) — 블록이 흩어지는 것을 보여 줌
const LEAD_FULL = 14; // 마우스가 내 토끼에서 이만큼 멀면 화면을 조준 쪽으로 다 옮김 (가까우면 조금만)
const IDLE_INPUT = Object.freeze({ move: Object.freeze({ x: 0, z: 0 }) }); // 처음 화면에서 내 토끼는 가만히

export function createFightGame({ container, capture = false }) {
  const world = createFightWorld(container);
  const { stage, view, events, player, enemies, bullets, pickups, props, debris, fx } = world;

  const sounds = createFightSounds();
  let quiet = false; // 다시 하기 준비 중에는 소리를 내지 않음 (처음 당근 '뿅' 등)
  connectFightSounds(events, { play: (name, options) => (quiet ? false : sounds.play(name, options)) });

  const input = createInput(container, { screenToGround: view.screenToGround });
  const hud = createHud({ sounds });
  const overlays = createOverlays({ sounds });
  const floats = createFloatText(document.getElementById('floatLayer'), view.worldToScreen);
  const stats = createRoundStats();

  const state = {
    phase: 'title',
    time: 0, // 싸운 시간 (초, 멈춤·멈칫 빼고)
    hitStop: 0, // 남은 멈칫 시간
    endTimer: 0, // 끝난 뒤 결과 화면까지 남은 시간
    calm: 0, // 깨어 있는 미친토끼가 하나도 없던 시간 (huntAfter 가 되면 하나가 찾아옴)
    roundUsed: false, // 이 판에서 이미 싸웠는지 (다시 시작할 때 새로 차림)
    frames: 0,
    result: null, // 마지막 결과 { won, time, hp, accuracy, kills, total, shots, hits }
  };
  let autopilot = null;
  let soundArmed = false;
  const aimDir = { x: 0, z: 0 };
  let pausedAim = null; // 멈출 때의 조준 방향 (멈춘 동안 화면이 뒤에서 미끄러지지 않게 그대로 씀)

  connectFightFeedback({ world, hud, floats, stats, hitStop: requestHitStop });

  function requestHitStop(seconds) {
    if (seconds > 0) state.hitStop = Math.min(FIGHT.hitStopMax, state.hitStop + seconds);
  }

  // ── 한 판 준비 · 시작 · 다시 하기 ──
  function resetRound() {
    quiet = true;
    world.resetRound();
    floats.clear();
    quiet = false;
    stats.reset();
    state.time = 0;
    state.hitStop = 0;
    state.endTimer = 0;
    state.calm = 0;
    state.roundUsed = false;
    state.result = null;
    syncHud();
  }

  function startGame() {
    if (state.roundUsed) resetRound();
    state.roundUsed = true;
    overlays.hideAll();
    // 소리는 처음 시작 단추를 누른 순간 켬 (그 뒤로는 소리 단추로 끈 것을 존중)
    if (!soundArmed && !capture && !new URLSearchParams(location.search).has('mute')) {
      soundArmed = true;
      sounds.setEnabled(true);
      hud.setSound?.(sounds.isEnabled());
    }
    hud.show(true);
    input.setEnabled(true);
    state.phase = 'play';
    events.emit('gameStarted', {});
  }

  function restart() {
    resetRound();
    startGame();
  }

  function pause() {
    if (state.phase !== 'play') return;
    const aim = cameraAim(); // 조작을 끄기 전에 지금 조준 방향을 기억
    pausedAim = aim ? { x: aim.x, z: aim.z } : null;
    state.phase = 'paused';
    stopInput();
    overlays.showPause(resume, restart);
  }

  function resume() {
    if (state.phase !== 'paused') return;
    overlays.hideAll();
    state.phase = 'play';
    input.setEnabled(true);
  }

  function stopInput() {
    input.setEnabled(false);
    input.setOverride(null);
    fx.aimLine(null, null, false);
  }

  function finish(won) {
    state.phase = won ? 'won' : 'lost';
    state.endTimer = END_DELAY;
    stopInput();
    const total = enemies.total;
    state.result = {
      won,
      time: state.time,
      hp: Math.max(0, player.health.hp),
      accuracy: stats.accuracy,
      kills: total - enemies.aliveCount(),
      total,
      shots: stats.shots,
      hits: stats.hits,
      swings: stats.swings,
      swingHits: stats.swingHits,
    };
    events.emit(won ? 'gameWon' : 'gameLost', { stats: state.result });
  }

  function showResult() {
    if (state.phase === 'won') overlays.showWin(state.result, restart);
    else overlays.showLose(state.result, restart);
  }

  // ── 매 장면 ──
  function update(rawDt) {
    const dt = Math.min(Math.max(rawDt, 0), MAX_STEP);
    state.frames++;
    input.update();
    const playing = state.phase === 'play';
    if (playing && autopilot) input.setOverride(autopilot(debug) ?? null);
    if (playing && input.state.pausePressed) pause();

    // 멈칫: 진짜 시간은 흐르지만 싸움은 멈춤 (카메라 흔들림만 계속)
    let simDt = dt;
    if (state.hitStop > 0 && (state.phase === 'play' || state.phase === 'won' || state.phase === 'lost')) {
      const used = Math.min(state.hitStop, dt);
      state.hitStop -= used;
      simDt = dt - used;
    }

    if (state.phase === 'title') updateTitle(dt);
    else if (state.phase !== 'paused' && simDt > 0) simulate(simDt);

    if (state.phase === 'play' && simDt > 0) {
      if (!player.alive) finish(false);
      else if (enemies.total > 0 && enemies.aliveCount() === 0) finish(true);
    } else if ((state.phase === 'won' || state.phase === 'lost') && state.endTimer > 0) {
      state.endTimer -= dt;
      if (state.endTimer <= 0) showResult();
    }

    // 멈칫 중에는 '막 누름' 을 지우지 않고 다음 장면으로 넘김 (누른 것이 사라지지 않게)
    if (simDt > 0 || state.phase !== 'play') input.endFrame();

    // 휴대폰 터치 중이면 화면 아래 조작 단추 높이만큼 비켜서 내 토끼를 보여 줌 (세로·가로 화면마다 다름)
    const touchBottom = FIGHT.camera.touchBottomPx;
    view.setSafeBottomPx?.(input.state.usingTouch && touchBottom ? touchBottom[stage.camera.aspect < 1 ? 'portrait' : 'landscape'] : 0);
    view.update(dt, { target: player.position, aimDir: cameraAim() });
    updateAimLine();
    syncHud();
  }

  // 싸움 계산 한 장면 (끝난 뒤에도 블록·미친토끼는 계속 움직임)
  function simulate(dt) {
    const frame = player.update(dt, state.phase === 'play' ? input.state : IDLE_INPUT);
    if (frame?.hitStop > 0) requestHitStop(frame.hitStop);
    enemies.update(dt);
    // 이긴 뒤에는 남은 적 총알이 내 토끼를 맞히지 않음 (결과 화면의 남은 체력이 정보판과 같게)
    bullets.update(dt, state.phase === 'won' ? enemies.list : world.fighters());
    pickups.update(dt, player);
    props.update(dt);
    debris.update(dt);
    fx.update(dt);
    floats.update(dt);
    if (state.phase === 'play') {
      state.time += dt;
      huntIfCalm(dt);
    }
  }

  // 미친토끼가 모두 쉬고 있는 채로 huntAfter 초가 지나면 가장 가까운 토끼가 찾아옴 (숨어만 있으면 심심하니까)
  function huntIfCalm(dt) {
    let awake = false;
    for (const e of enemies.list) {
      if (e.alive && e.state !== 'idle') {
        awake = true;
        break;
      }
    }
    if (awake) {
      state.calm = 0;
      return;
    }
    state.calm += dt;
    if (state.calm >= FIGHT.enemies.huntAfter) {
      state.calm = 0;
      enemies.wakeNearest(player.position.x, player.position.z);
    }
  }

  // 처음 화면: 싸우지 않고 토끼들이 제자리에서 숨만 쉼
  function updateTitle(dt) {
    player.update(dt, IDLE_INPUT);
    for (const e of enemies.list) if (e.alive) e.rig.update(dt, e.pose);
    pickups.update(dt, null);
    debris.update(dt);
    fx.update(dt);
    floats.update(dt);
  }

  // 화면을 조준 쪽으로 미리 옮길 방향 (마우스는 멀수록 많이, 터치 막대는 기울인 만큼)
  function cameraAim() {
    if (state.phase === 'paused') return pausedAim; // 멈춘 동안은 멈출 때의 방향 그대로
    if (state.phase !== 'play' || !player.alive) return null;
    const s = input.state;
    if (s.aimDir && (s.aimDir.x || s.aimDir.z)) return s.aimDir;
    if (!s.aimPoint) return null;
    const dx = s.aimPoint.x - player.position.x;
    const dz = s.aimPoint.z - player.position.z;
    const length = Math.hypot(dx, dz);
    if (length < 1e-3) return null;
    const k = Math.min(1, length / LEAD_FULL) / length;
    aimDir.x = dx * k;
    aimDir.z = dz * k;
    return aimDir;
  }

  // 컴퓨터에서 블록 총을 들고 있으면 총구 → 마우스 쪽 흐린 점선
  function updateAimLine() {
    const s = input.state;
    const show = state.phase === 'play' && player.alive && !s.usingTouch && !!s.aimPoint && player.weapons.current === 'blaster';
    fx.aimLine(player.muzzle, s.aimPoint, show);
  }

  function syncHud() {
    hud.setHp(player.health.hp, player.health.maxHp);
    hud.setEnemies(enemies.aliveCount(), enemies.total);
    hud.setWeapon(player.weapons.info());
    hud.setJumpReady(player.jumpReady ?? 1);
  }

  // 창을 벗어나면 저절로 멈춤 (녹화 모드는 제외)
  if (!capture) {
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', () => document.hidden && pause());
  }

  const debug = {
    state,
    stats,
    world,
    player,
    enemies,
    bullets,
    props,
    pickups,
    collision: world.collision,
    input,
    view,
    fx,
    events,
    debris,
    stage,
    hud,
    overlays,
    floats,
    sounds,
    startGame,
    restart,
    pause,
    resume,
    setAutopilot(fn) {
      autopilot = typeof fn === 'function' ? fn : null;
      if (!autopilot) input.setOverride(null);
    },
  };

  // 효과 셰이더 미리 만들기 (첫 총·첫 칼·첫 망치 때 멈칫하지 않게): 효과를 한 번 띄워 그리고 바로 치움
  // 불티·연기는 fx.update 에서 보이게 되므로 꼭 한 번 update 한 뒤 그림. 조준 점선도 함께.
  // 그린 뒤 compile 로 아직 숨어 있는 것(망치 충격 고리 등)의 셰이더도 만들어 둠
  // 다 치운 뒤 한 번 더 그려서 화면(그림판)에도 효과가 남지 않게 함
  function warmUpEffects() {
    const at = player.position.clone().setY(3);
    fx.muzzleFlash(at, 0);
    fx.hitSpark(at);
    fx.slashArc(player.position, 0, 2.6, 6, 1);
    const ring = fx.telegraph(player.position, 6, 0.8);
    fx.popRing(player.position, 0.5);
    fx.aimLine(player.muzzle, { x: at.x + 6, y: at.y, z: at.z }, true);
    fx.update(1 / 60);
    stage.render();
    stage.renderer.compile(stage.scene, stage.camera);
    ring.cancel();
    fx.clear();
    fx.aimLine(null, null, false);
    stage.render();
  }

  // 처음: 싸움터를 차려 두고 처음 화면을 띄움
  resetRound();
  warmUpEffects();
  input.setEnabled(false);
  overlays.showTitle(startGame);
  document.getElementById('bootMessage')?.setAttribute('hidden', '');

  return {
    update,
    render: () => stage.render(),
    debug,
  };
}
