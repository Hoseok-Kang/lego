// 게임 정보판 (HUD)
// 3D 전장 위에 떠 있는 글자와 버튼을 맡습니다.
//   위쪽: 웨이브 n/10, 땅 넓이, 성 체력 막대, 골드, 남은 몬스터 수
//   그 아래: '다음 웨이브 5초' 안내 + [바로 시작] 버튼, 잠깐 떴다 사라지는 알림
//   아래쪽: 스킬 단추 줄 (넓은 화면은 가운데, 휴대폰은 조작 버튼 위), 속도·멈춤·소리·내 그림 버튼
// 글자(문구)는 game.html, 모양(색·크기·위치)은 css/game.css 에서 바꿉니다.
//
//   const hud = createHud({ onStartWave, onToggleSpeed, onTogglePause, onToggleSound, onOpenArt, onSkill })
//   hud.setGold(n)                       골드
//   hud.setWave(n, total)                웨이브 n/total
//   hud.setLand(칸 수)                    땅 넓이 ('땅 56칸')
//   hud.setCastleHp(hp, max)             성 체력 막대와 숫자
//   hud.setEnemiesLeft(n)                남은 몬스터 수
//   hud.setNextWaveCountdown(초 | null)   다음 웨이브까지 남은 시간 (null 이면 안내 숨김)
//   hud.setSpeed(x)                      속도 버튼 글자 (1×, 2×, 3×)
//   hud.setPaused(bool)                  멈춤 버튼 모양 + '잠깐 멈춤' 표시
//   hud.setSound(bool)                   소리 버튼 모양
//   hud.setSkills(목록)                   스킬 단추 (skills.list() 결과를 그대로 넘김)
//                                        [{ id, name, description, unlocked, ready, cooldownLeft, cooldownTotal,
//                                           needsTarget, targeting, usable }]
//                                        열린(unlocked) 스킬만 보이고, 대기시간은 시계처럼 줄어드는 그림자 + 남은 초,
//                                        겨누는 중(targeting)이면 눌린 모양 + '땅을 눌러 …' 안내
//   hud.toast(글자)                       잠깐 떴다 사라지는 알림
//   hud.floatText(x, y, 글자, 종류)         화면 위 한 점(x, y)에서 떠올랐다 사라지는 글자
//                                        종류: 'gold'(노랑) | 'damage'(빨강) | 'info'(흰색)
// 스킬 단추를 누르면 onSkill(id) 를 부릅니다. 키보드: 숫자 1·2·3 = 보이는 스킬 단추 차례대로, Esc = 겨누기 취소.
// 매 장면마다 불려도 괜찮도록, 값이 바뀔 때만 화면을 고칩니다.

const TOAST_SECONDS = 2.6; // 알림이 떠 있는 시간
const TOAST_MAX = 3; // 한꺼번에 보이는 알림 수
const FLOAT_SECONDS = 0.9; // 떠오르는 글자가 사라지기까지 걸리는 시간
const FLOAT_RISE_PX = 46; // 떠오르는 높이 (화면 점 단위)
const FLOAT_MAX = 24; // 한꺼번에 보이는 떠오르는 글자 수 (넘으면 가장 오래된 것을 다시 씀)
const HP_MID = 0.5; // 성 체력이 이 비율 아래면 막대가 노란색
const HP_LOW = 0.25; // 이 비율 아래면 빨간색으로 깜빡임
const COUNTDOWN_SOON = 3; // 다음 웨이브까지 이 초 이하로 남으면 안내를 강조
const SKILL_SWEEP_STEPS = 120; // 스킬 대기시간 그림자를 몇 단계로 줄일지 (클수록 부드럽지만 화면을 자주 고침)
const SKILL_IDLE_TOAST_GAP = 1.5; // 쓸 수 없는 스킬 단추를 연달아 눌러도 알림은 이 초에 한 번만

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function createHud(handlers = {}) {
  const el = (id) => document.getElementById(id);
  const ui = {
    wave: el('hudWave'),
    waveTotal: el('hudWaveTotal'),
    landCard: el('hudLandCard'),
    land: el('hudLand'),
    hpCard: el('hudHp'),
    hpText: el('hudHpText'),
    hpTrack: el('hudHpTrack'),
    hpFill: el('hudHpFill'),
    goldCard: el('hudGoldCard'),
    gold: el('hudGold'),
    enemies: el('hudEnemies'),
    countdown: el('countdown'),
    countdownSeconds: el('countdownSeconds'),
    startWaveBtn: el('startWaveBtn'),
    pausedBadge: el('pausedBadge'),
    toasts: el('toasts'),
    floatLayer: el('floatLayer'),
    speedBtn: el('speedBtn'),
    speedValue: el('speedValue'),
    pauseBtn: el('pauseBtn'),
    soundBtn: el('soundBtn'),
    artBtn: el('artBtn'),
    skillBar: el('skillBar'),
    skillButtons: el('skillButtons'),
    skillTemplate: el('skillTemplate'),
    skillHint: el('skillHint'),
    skillIdleTemplate: el('skillIdleTemplate'),
  };

  // 버튼 연결
  const call = (name) => () => handlers[name]?.();
  ui.startWaveBtn.addEventListener('click', call('onStartWave'));
  ui.speedBtn.addEventListener('click', call('onToggleSpeed'));
  ui.pauseBtn.addEventListener('click', call('onTogglePause'));
  ui.soundBtn.addEventListener('click', call('onToggleSound'));
  ui.artBtn.addEventListener('click', call('onOpenArt'));

  // 마지막으로 화면에 쓴 값 (같은 값이면 다시 쓰지 않음)
  const shown = {
    gold: null,
    wave: null,
    total: null,
    land: null,
    hp: null,
    maxHp: null,
    hpLevel: 'ok',
    enemies: null,
    countdown: null,
    countdownSoon: false,
    speed: null,
    paused: null,
    sound: null,
  };
  let goldPop = null;
  let hpShake = null;
  let landPop = null;

  function setGold(n) {
    const gold = Math.round(n);
    if (gold === shown.gold) return;
    const gained = shown.gold !== null && gold > shown.gold;
    shown.gold = gold;
    ui.gold.textContent = gold.toLocaleString('ko-KR');
    if (gained) goldPop = bump(ui.goldCard, goldPop, [{ scale: 1 }, { scale: 1.1 }, { scale: 1 }], 260);
  }

  function setWave(n, total) {
    if (n !== shown.wave) {
      shown.wave = n;
      ui.wave.textContent = n;
    }
    if (total !== shown.total) {
      shown.total = total;
      ui.waveTotal.textContent = total;
    }
  }

  function setLand(size) {
    const value = Math.round(size);
    if (!Number.isFinite(value) || value === shown.land) return;
    const grew = shown.land !== null && value > shown.land;
    shown.land = value;
    ui.land.textContent = value;
    if (grew) landPop = bump(ui.landCard, landPop, [{ scale: 1 }, { scale: 1.16 }, { scale: 0.97 }, { scale: 1 }], 420);
  }

  function setCastleHp(hp, max) {
    const value = Math.max(0, Math.ceil(hp));
    if (value === shown.hp && max === shown.maxHp) return;
    const lost = shown.hp !== null && value < shown.hp && max === shown.maxHp;
    shown.hp = value;
    shown.maxHp = max;
    const ratio = max > 0 ? Math.min(1, Math.max(0, hp / max)) : 0;
    ui.hpText.textContent = `${value}/${max}`;
    ui.hpFill.style.transform = `scaleX(${ratio})`;
    ui.hpTrack.setAttribute('aria-valuemax', String(max));
    ui.hpTrack.setAttribute('aria-valuenow', String(value));
    const level = ratio <= HP_LOW ? 'low' : ratio <= HP_MID ? 'mid' : 'ok';
    if (level !== shown.hpLevel) {
      shown.hpLevel = level;
      ui.hpFill.dataset.level = level;
    }
    if (lost && !isRunning(hpShake)) {
      hpShake = bump(
        ui.hpCard,
        hpShake,
        [{ translate: '0 0' }, { translate: '-4px 0' }, { translate: '4px 0' }, { translate: '-2px 0' }, { translate: '0 0' }],
        280,
      );
    }
  }

  function setEnemiesLeft(n) {
    if (n === shown.enemies) return;
    shown.enemies = n;
    ui.enemies.textContent = n;
  }

  function setNextWaveCountdown(seconds) {
    const value = seconds === null || seconds === undefined ? null : Math.max(0, Math.ceil(seconds));
    if (value === shown.countdown) return;
    shown.countdown = value;
    if (value === null) {
      ui.countdown.hidden = true;
      return;
    }
    ui.countdownSeconds.textContent = value;
    ui.countdown.hidden = false;
    const soon = value <= COUNTDOWN_SOON;
    if (soon !== shown.countdownSoon) {
      shown.countdownSoon = soon;
      ui.countdown.classList.toggle('is-soon', soon);
    }
  }

  function setSpeed(x) {
    if (x === shown.speed) return;
    shown.speed = x;
    ui.speedValue.textContent = `${x}×`;
    ui.speedBtn.setAttribute('aria-label', `게임 속도 ${x}배 (눌러서 바꾸기)`);
  }

  function setPaused(paused) {
    const value = Boolean(paused);
    if (value === shown.paused) return;
    shown.paused = value;
    ui.pauseBtn.setAttribute('aria-pressed', String(value));
    ui.pausedBadge.hidden = !value;
  }

  function setSound(on) {
    const value = Boolean(on);
    if (value === shown.sound) return;
    shown.sound = value;
    ui.soundBtn.setAttribute('aria-pressed', String(value));
  }

  // ── 스킬 단추 ──
  // 단추 상태(data-state): 'ready' 쓸 수 있음 | 'idle' 쓸 수 있지만 지금은 효과 없음 | 'cooling' 대기 중 | 'aiming' 겨누는 중
  const skillEntries = new Map(); // 스킬 id → 단추와 마지막으로 그린 값
  const skillOrder = []; // 화면 순서 (키보드 숫자용)
  let skillsSeeded = false; // 처음 한 번은 '새 스킬' 효과 없이 그림
  let visibleSkills = -1;
  let aimingSkill = null;
  let lastIdleToast = { id: null, at: -Infinity };
  const hintTexts = Array.from(ui.skillHint.querySelectorAll('.skill-hint-text'));
  const idleTexts = Array.from(ui.skillIdleTemplate?.content.querySelectorAll('[data-skill]') ?? []);

  function createSkillButton(skill) {
    const button = ui.skillTemplate.content.firstElementChild.cloneNode(true);
    const entry = {
      id: skill.id,
      button,
      name: button.querySelector('.skill-name'),
      number: button.querySelector('.skill-cool-num'),
      key: button.querySelector('.skill-key'),
      shownName: null,
      visible: null,
      state: null,
      sweep: -1,
      seconds: -1,
      keyNumber: 0,
      needsTarget: Boolean(skill.needsTarget),
      flash: null,
    };
    button.dataset.skill = skill.id;
    button.querySelector('.skill-icon').dataset.skill = skill.id;
    if (skill.description) button.title = skill.description;
    button.hidden = true;
    button.addEventListener('click', () => pressSkill(entry));
    ui.skillButtons.append(button);
    skillEntries.set(skill.id, entry);
    skillOrder.push(entry);
    return entry;
  }

  function setSkills(list) {
    if (!list) return;
    let visible = 0;
    let aiming = null;
    for (let i = 0; i < list.length; i++) {
      const skill = list[i];
      const entry = skillEntries.get(skill.id) ?? createSkillButton(skill);
      const unlocked = Boolean(skill.unlocked);
      if (unlocked !== entry.visible) {
        entry.visible = unlocked;
        entry.button.hidden = !unlocked;
        if (unlocked && skillsSeeded) entry.flash = bump(entry.button, entry.flash, NEW_SKILL_KEYFRAMES, 620);
      }
      if (!unlocked) continue;
      visible += 1;
      if (skill.targeting) aiming = skill.id;
      if (entry.keyNumber !== visible) {
        entry.keyNumber = visible;
        entry.key.textContent = visible;
      }
      drawSkill(entry, skill);
    }
    skillsSeeded = true;
    if (visible !== visibleSkills) {
      visibleSkills = visible;
      ui.skillBar.hidden = visible === 0;
      ui.skillBar.dataset.count = String(visible);
    }
    setAiming(aiming);
  }

  function drawSkill(entry, skill) {
    const { button } = entry;
    if (skill.name !== entry.shownName) {
      entry.shownName = skill.name;
      entry.name.textContent = skill.name;
    }
    const state = skill.targeting ? 'aiming' : !skill.ready ? 'cooling' : skill.usable === false ? 'idle' : 'ready';
    if (state !== entry.state) {
      const wasCooling = entry.state === 'cooling';
      entry.state = state;
      button.dataset.state = state;
      button.setAttribute('aria-disabled', String(state === 'cooling' || state === 'idle'));
      if (entry.needsTarget) button.setAttribute('aria-pressed', String(state === 'aiming'));
      if (wasCooling && state !== 'cooling') entry.flash = bump(button, entry.flash, READY_KEYFRAMES, 520);
    }
    // 대기시간: 남은 비율만큼 그림자 (시계 방향으로 줄어듦) + 남은 초
    const cooling = state === 'cooling';
    const left = cooling ? Math.max(0, skill.cooldownLeft) : 0;
    const fraction = cooling && skill.cooldownTotal > 0 ? Math.min(1, left / skill.cooldownTotal) : 0;
    const sweep = Math.ceil(fraction * SKILL_SWEEP_STEPS) / SKILL_SWEEP_STEPS;
    if (sweep !== entry.sweep) {
      entry.sweep = sweep;
      button.style.setProperty('--cool', String(sweep));
    }
    const seconds = cooling ? Math.ceil(left) : 0;
    if (seconds !== entry.seconds) {
      entry.seconds = seconds;
      entry.number.textContent = seconds > 0 ? seconds : '';
      button.setAttribute('aria-label', seconds > 0 ? `${skill.name} (${seconds}초 뒤에 다시 쓸 수 있어요)` : skill.name);
    }
  }

  function setAiming(id) {
    if (id === aimingSkill) return;
    aimingSkill = id;
    ui.skillHint.hidden = id === null;
    document.body.classList.toggle('is-aiming', id !== null);
    if (id === null) return;
    const specific = hintTexts.some((text) => text.dataset.skill === id);
    for (const text of hintTexts) text.hidden = text.dataset.skill !== (specific ? id : '');
  }

  function pressSkill(entry) {
    if (!entry.visible) return;
    if (entry.state === 'idle') idleToast(entry.id);
    handlers.onSkill?.(entry.id);
  }

  // 효과가 없는 스킬을 누르면 왜 안 되는지 알려 줌 (연달아 눌러도 한 번만)
  function idleToast(id) {
    const now = performance.now() / 1000;
    if (lastIdleToast.id === id && now - lastIdleToast.at < SKILL_IDLE_TOAST_GAP) return;
    lastIdleToast = { id, at: now };
    const text = idleTexts.find((item) => item.dataset.skill === id) ?? idleTexts.find((item) => item.dataset.skill === '');
    if (text) toast(text.textContent.trim());
  }

  // 키보드: 숫자 1·2·3 으로 스킬, Esc 로 겨누기 취소 (글자 입력 중이거나 다른 창이 열려 있으면 무시)
  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (isBusyTarget(event.target) || document.querySelector('dialog[open], [aria-modal="true"]:not([hidden])')) return;
    if (event.key === 'Escape') {
      if (aimingSkill === null) return;
      event.preventDefault();
      handlers.onSkill?.(aimingSkill);
      return;
    }
    if (event.key.length !== 1 || event.key < '1' || event.key > '9') return;
    const number = Number(event.key);
    const entry = skillOrder.find((item) => item.visible && item.keyNumber === number);
    if (!entry) return;
    event.preventDefault();
    pressSkill(entry);
  });

  // ── 알림 ──
  function toast(text) {
    const item = document.createElement('p');
    item.className = 'toast';
    item.textContent = text;
    ui.toasts.append(item);
    const items = ui.toasts.querySelectorAll('.toast:not(.is-leaving)');
    for (let i = 0; i < items.length - TOAST_MAX; i++) removeToast(items[i], 0);
    removeToast(item, TOAST_SECONDS * 1000);
  }

  function removeToast(item, delayMs) {
    setTimeout(() => {
      item.classList.add('is-leaving');
      setTimeout(() => item.remove(), 260);
    }, delayMs);
  }

  // ── 떠오르는 글자 ── (만들어 둔 글자 칸을 돌려 써서 많이 떠도 가볍게)
  const floats = [];
  let nextFloat = 0;

  function floatText(clientX, clientY, text, kind = 'gold') {
    let item = floats.find((entry) => !entry.busy);
    if (!item) {
      if (floats.length < FLOAT_MAX) {
        const node = document.createElement('span');
        node.className = 'float-text';
        ui.floatLayer.append(node);
        item = { node, busy: false, animation: null, timer: 0 };
        floats.push(item);
      } else {
        item = floats[nextFloat];
        nextFloat = (nextFloat + 1) % floats.length;
      }
    }
    const { node } = item;
    item.busy = true;
    item.animation?.cancel();
    clearTimeout(item.timer);
    node.textContent = text;
    node.dataset.kind = kind;
    // 오래 떠 있는 글자 대신 새 글자가 위에 보이도록 맨 뒤로 옮김
    ui.floatLayer.append(node);

    const x = Math.round(clientX);
    const y = Math.round(clientY);
    const from = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    const rise = reducedMotion.matches ? 0 : FLOAT_RISE_PX;
    const to = `translate(${x}px, ${y - rise}px) translate(-50%, -50%)`;
    const duration = FLOAT_SECONDS * 1000;
    if (typeof node.animate === 'function') {
      const keyframes = reducedMotion.matches
        ? [{ transform: from, opacity: 1 }, { transform: to, opacity: 0 }]
        : [
            { transform: `${from} scale(0.6)`, opacity: 0 },
            { transform: `${from} scale(1.15)`, opacity: 1, offset: 0.15 },
            { transform: `${to} scale(1)`, opacity: 0 },
          ];
      item.animation = node.animate(keyframes, { duration, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    } else {
      node.style.transform = from;
      node.style.opacity = '1';
    }
    item.timer = setTimeout(() => {
      item.busy = false;
      if (!item.animation) node.style.opacity = '0';
    }, duration);
  }

  return {
    setGold,
    setWave,
    setLand,
    setCastleHp,
    setEnemiesLeft,
    setNextWaveCountdown,
    setSpeed,
    setPaused,
    setSound,
    setSkills,
    toast,
    floatText,
  };
}

// 스킬 단추 효과: 대기시간이 끝났을 때 / 보상 카드로 새 스킬이 열렸을 때
const READY_KEYFRAMES = [
  { scale: 1, outline: '3px solid rgb(242 205 55 / 0.95)', outlineOffset: '0px' },
  { scale: 1.08, outline: '4px solid rgb(242 205 55 / 0.7)', outlineOffset: '3px', offset: 0.35 },
  { scale: 1, outline: '4px solid rgb(242 205 55 / 0)', outlineOffset: '9px' },
];
const NEW_SKILL_KEYFRAMES = [
  { scale: 0.4, opacity: 0, translate: '0 18px' },
  { scale: 1.14, opacity: 1, translate: '0 -4px', offset: 0.55 },
  { scale: 1, opacity: 1, translate: '0 0' },
];

// 짧게 통통 튀는 효과 (움직임 줄이기 설정이면 생략)
function bump(node, previous, keyframes, duration) {
  if (reducedMotion.matches || typeof node.animate !== 'function') return null;
  previous?.cancel();
  return node.animate(keyframes, { duration, easing: 'ease-out' });
}

function isRunning(animation) {
  return animation !== null && animation.playState === 'running';
}

// 글자를 입력하는 칸이나 메뉴·창 안에서 누른 키는 스킬 단축키로 쓰지 않음
function isBusyTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return true;
  return Boolean(target.closest('dialog, [role="dialog"]'));
}
