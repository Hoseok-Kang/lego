// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 괴수 직접 조종 (습격 중)
// 처음엔 늘 자동. 막대 · 공격 단추 · 키 · 건물 누르기를 쓰는 순간 '직접 조종' 이 되고,
// idleSeconds(villainConfig 의 control) 동안 아무 조작이 없으면 조용히 다시 자동으로 돌아갑니다. 칩을 눌러 바꿀 수도 있어요.
//   휴대폰: 왼쪽을 끌면 움직이기 막대, 오른쪽 둥근 단추 = 부품 공격 · 박치기 (단추판 모양은 ui/controlPad.js)
//   컴퓨터: W A S D · 화살표 = 걷기, 1~5 = 부품 단추 차례대로, 스페이스 = 박치기, 건물 · 영웅을 마우스로 누르면 그것을 노림
//   공격 단추를 누르면 한 번 (닿는 것이 없으면 허공에), 누르고 있으면 닿는 것이 있을 때마다 식는 대로 계속.
//   노리는 것은 괴수가 알아서 고름 (monster/monsterManual.js)
// 조종할 수 있는 때: 습격 화면의 부수기 · 맞대결 · 남은 마을 부수기 장면. 그 밖에는 자동
//   (괴수가 쌓이는 중 · 영웅 출동 경보 동안은 단추가 흐리게, 끝나는 중 · 결과 · 다른 화면 · 확인 창 · '가로로 돌려 주세요' 동안은 숨김)
//
//   const control = createMonsterControl({ world, hud, state, capture })
//       world: 3D 세상 (gameWorld.js 의 raid · stage · town),  hud: 습격 정보판 (raidHud.js, 그 안에 단추판을 넣음)
//       state: 게임 상태 { screen, paused } (game.js),  capture: 녹화 모드면 손가락 · 키보드를 받지 않음
//   control.update(dt)      매 장면, 게임 계산 바로 전에 (습격 화면이 아니어도 불러 주세요: 단추판을 숨김)
//   control.mode            'auto' | 'manual'
//   control.setMode(이름)    바꾸기 (시험용으로도)
//   control.pad             단추판 (ui/controlPad.js)
//
// 숫자는 villainConfig.js 의 control, 어떤 키가 무엇을 하는지는 아래 MOVE_KEYS / PART_KEYS 에서 바꿉니다.
// (한글 입력 상태여도 되도록 글자가 아니라 '키 자리'(event.code)로 봅니다)
// ─────────────────────────────────────────────────────────────

import * as THREE from '../../lib/three.js';
import { VILLAIN } from '../villainConfig.js';
import { attackCooldown } from '../monster/monsterAttacks.js';
import { createControlPad } from '../ui/controlPad.js';
import { installLandscapeGuard } from '../../core/landscapeGuard.js';

const HINT_KEY = 'villainTycoon.controlHint'; // 첫 습격 안내를 본 적이 있는지 (브라우저에 기억)
const LIVE = new Set(['smashing', 'duel', 'cleanup']); // 조종할 수 있는 장면
const WAIT = new Set(['building', 'alert']); // 단추는 보이지만 흐리게
const MARK_LIFT = 1.4; // 노리는 것 화살표를 꼭대기보다 이만큼(칸) 위에
const PICK_MIN_PX = 22; // 작은 건물 · 영웅도 이만큼(화면 px) 둘레를 누르면 고름

// 걷는 키 → [x, z] (화면 위쪽 = -z)
const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};
// 공격 키 → 부품 단추 차례 (0 = 첫째) 또는 'headbutt'
const PART_KEYS = {
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4,
  Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4,
  Space: 'headbutt',
};

function readFlag() {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function writeFlag() {
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    // 기억을 못 하면 다음 습격에 한 번 더 보일 뿐
  }
}

export function createMonsterControl({ world, hud, state, capture = false }) {
  const cfg = VILLAIN.control;
  const raid = world.raid;
  const view = world.stage.view;
  const canvas = world.stage.renderer.domElement;
  const tmp = new THREE.Vector3();
  const keys = new Set(); // 눌린 걷기 키
  const held = new Set(); // 누르고 있는 공격 (단추 · 키)
  let monster = null; // 단추판이 맞춰진 괴수 (새 습격이면 바뀜)
  let mode = 'auto';
  let idle = 0; // 아무 조작 없이 흐른 시간 (초)
  let queued = null; // 다른 공격 중에 누른 공격 { type, left }
  let blocked = false; // '가로로 돌려 주세요' 안내판
  let hintChecked = false;
  let hintLeft = 0;
  const coarse = (() => {
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch {
      return false;
    }
  })();

  const pad = createControlPad(hud.el, {
    surface: capture ? null : canvas,
    onPress: press,
    onRelease: (type) => held.delete(type),
    onTap: tap,
    onChip: () => (mode === 'manual' ? setMode('auto') : take()),
    onStick: take,
  });
  pad.setKeys(!coarse);

  // ── 모드 ──
  function setMode(next) {
    mode = next === 'manual' ? 'manual' : 'auto';
    idle = 0;
    monster?.setManual?.(mode === 'manual');
    if (mode === 'auto') {
      queued = null;
      monster?.steer?.(null);
    }
  }

  function take() {
    idle = 0;
    if (mode !== 'manual') setMode('manual');
  }

  // ── 공격 ──
  function partOf(index) {
    return monster?.partTypes?.[index] ?? null;
  }

  function press(type) {
    if (!monster || !type) return;
    take();
    held.add(type);
    const lost = type !== 'headbutt' && !monster.attacks.includes(type);
    if (lost) {
      pad.nope(type);
      return;
    }
    if (monster.useAttack(type)) return;
    queued = { type, left: cfg.pressBuffer };
    // 한참 더 식어야 하면 '아직이에요' 도리도리 (곧 준비되면 잠깐 기억했다가 씀)
    if (!monster.busy && monster.cooldownOf(type) * attackCooldown(type) > cfg.pressBuffer) pad.nope(type);
  }

  // ── 3D 마을을 톡 / 클릭 → 그 자리의 건물 · 영웅을 노림 ──
  function candidates() {
    const list = (world.town?.buildings ?? []).filter((b) => b.alive);
    const hero = raid.hero;
    if (hero && hero.active && hero.alive) list.push(hero);
    return list;
  }

  function pickAt(x, y) {
    let best = null;
    let bestScore = Infinity;
    for (const other of candidates()) {
      const h = other.height || 4;
      const mid = view.worldToScreen(tmp.set(other.position.x, h * 0.5, other.position.z));
      const side = view.worldToScreen(tmp.set(other.position.x + (other.radius || 1), h * 0.5, other.position.z));
      const top = view.worldToScreen(tmp.set(other.position.x, h, other.position.z));
      const base = view.worldToScreen(tmp.set(other.position.x, 0, other.position.z));
      const half = Math.max(PICK_MIN_PX, Math.abs(side.x - mid.x));
      const dx = Math.abs(x - mid.x);
      if (dx > half || y < top.y - half * 0.6 || y > base.y + half * 0.4) continue;
      // 가운데에 가까울수록, 카메라 쪽(앞)에 있을수록 먼저
      const score = dx / half + Math.abs(y - mid.y) / Math.max(20, base.y - top.y) - other.position.z * 0.03;
      if (score < bestScore) {
        bestScore = score;
        best = other;
      }
    }
    return best;
  }

  function tap(x, y) {
    if (!monster) return;
    const target = pickAt(x, y);
    if (!target) return;
    take();
    monster.aimAt(target);
  }

  // ── 키보드 ──
  const typing = (target) => target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  const live = () => pad.el.dataset.state === 'on';

  function onKeyDown(event) {
    if (!live() || event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
    const code = event.code;
    if (MOVE_KEYS[code]) {
      event.preventDefault();
      keys.add(code);
      pad.setKeys(true);
      take();
      return;
    }
    if (!(code in PART_KEYS)) return;
    event.preventDefault(); // 스페이스가 마지막에 누른 단추(빠르기 등)를 다시 누르지 않게
    pad.setKeys(true);
    if (event.repeat) return;
    const slot = PART_KEYS[code];
    const type = slot === 'headbutt' ? 'headbutt' : partOf(slot);
    if (type) press(type);
  }

  function onKeyUp(event) {
    if (MOVE_KEYS[event.code]) keys.delete(event.code);
    if (event.code in PART_KEYS) {
      const slot = PART_KEYS[event.code];
      held.delete(slot === 'headbutt' ? 'headbutt' : partOf(slot));
      if (live()) event.preventDefault();
    }
  }

  function letGoAll() {
    keys.clear();
    held.clear();
    queued = null;
    pad.release();
  }

  if (!capture) {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', letGoAll);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) letGoAll();
    });
    installLandscapeGuard({
      onChange(on) {
        blocked = on;
        if (on) {
          letGoAll();
          pad.setState('off'); // 안내판이 뜬 동안은 게임이 멈춰서 update 가 안 불림 → 바로 숨김
        }
      },
    });
  }

  // ── 새 습격: 단추를 이번 괴수에 맞춤 ──
  function adopt(next) {
    monster = next || null;
    letGoAll();
    mode = 'auto';
    idle = 0;
    pad.setParts(monster?.partTypes ?? []);
    pad.setMode('auto');
    pad.mark(null);
  }

  // 첫 습격 때 한 번만 안내 글
  function showHintOnce() {
    if (hintChecked || capture) return;
    hintChecked = true;
    if (readFlag()) return;
    writeFlag();
    hintLeft = cfg.hintSeconds;
    pad.hint(true, coarse ? 'touch' : 'keys');
  }

  function steerNow() {
    if (!keys.size) return pad.stick;
    let x = 0;
    let z = 0;
    for (const code of keys) {
      x += MOVE_KEYS[code][0];
      z += MOVE_KEYS[code][1];
    }
    const length = Math.hypot(x, z);
    return length > 0 ? { x: x / length, z: z / length } : { x: 0, z: 0 };
  }

  // ── 매 장면 ──
  function update(dt) {
    if (raid.monster !== monster) adopt(raid.monster);
    const m = monster;
    const phase = raid.state.phase;
    const onRaid = state.screen === 'raid' && !blocked && !capture;
    const dialog = state.paused || !!document.querySelector('#ui .vt-dialog, #ui .intro-veil');
    const ok = onRaid && !dialog && !!m && m.alive;
    const usable = ok && m.isBuilt && LIVE.has(phase) && !raid.state.finishing && !(phase === 'cleanup' && raid.state.cleanupLeft <= 0);
    pad.setState(usable ? 'on' : ok && (WAIT.has(phase) || LIVE.has(phase)) && !raid.state.finishing ? 'wait' : 'off');

    if (hintLeft > 0) {
      hintLeft -= dt;
      if (hintLeft <= 0 || mode === 'manual' || !usable) {
        hintLeft = 0;
        pad.hint(false);
      }
    }
    if (!usable) {
      if (mode === 'manual') setMode('auto');
      if (keys.size || held.size || queued) letGoAll();
      pad.setMode('auto');
      pad.mark(null);
      return;
    }
    showHintOnce();

    // 조작 읽기: 막대 · 키를 미는 중이면 직접 조종
    const steer = steerNow();
    const pushing = Math.hypot(steer.x, steer.z) > 0.01;
    if (pushing) take();
    if (pad.stick.held || keys.size || held.size) idle = 0;
    else idle += dt;

    if (mode === 'manual') {
      m.steer(pushing ? steer : null);
      for (const type of held) if (m.useAttack(type, true)) break; // 누르고 있으면 식는 대로 계속 (닿는 것이 있을 때만)
      if (queued) {
        queued.left -= dt;
        if (m.useAttack(queued.type) || queued.left <= 0) queued = null;
      }
      if (idle >= cfg.idleSeconds) setMode('auto'); // 가만두면 조용히 자동으로
    }

    // 단추 모양: 모드 칩, 식는 고리, 떨어진 부품
    pad.setMode(mode, mode === 'manual' ? idle / cfg.idleSeconds : 0);
    for (const type of m.partTypes) pad.setCooldown(type, m.cooldownOf(type), !m.attacks.includes(type));
    pad.setCooldown('headbutt', m.cooldownOf('headbutt'), false);
    const aim = mode === 'manual' ? m.aim : null;
    pad.mark(aim ? view.worldToScreen(tmp.set(aim.position.x, (aim.height || 4) + MARK_LIFT, aim.position.z)) : null);
  }

  return {
    update,
    pad,
    setMode,
    get mode() {
      return mode;
    },
  };
}
