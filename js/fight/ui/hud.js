// 정보판 (싸우는 동안 화면에 떠 있는 것들)
// 왼쪽 위: 내 토끼 얼굴 + 분홍 체력 막대 + 숫자. 얼굴의 귀 블록도 체력만큼만 남아요 (게임 속 토끼처럼!)
// 가운데 위: 남은 미친토끼 '3 / 5'. 오른쪽 위: 소리 · 멈춤 단추
// 오른쪽 아래(컴퓨터): 무기 칸 [1 블록 총 탄 수·장전 고리] [2 블록 칼] + 구르기 준비
// 휴대폰: 공격 단추에 지금 무기 그림과 남은 탄, 총⇄칼 단추에 지금 무기 표시, 구르기 단추에 준비 고리 (css/fight-touch.css)
// 마우스를 따라다니는 조준점, 체력이 적으면 화면 가장자리가 두근두근 빨갛게.
//
//   const hud = createHud({ sounds })   sounds: fightSounds.js (있으면 소리 단추가 저절로 켜고 끔. 없어도 됨)
//   hud.setHp(체력, 최대)                 체력 막대·숫자·귀 블록 (줄면 카드가 흔들림)
//   hud.setEnemies(남은 수, 전체)          '미친토끼 3 / 5' (줄면 통 튀어 오름)
//   hud.setWeapon({ id, name, ammo, magazine, reloading, reloadProgress })   weapons.info() 를 그대로
//   hud.setRollReady(0~1)                다시 구를 수 있을 때까지 차오름 (1 = 준비)
//   hud.flashDamage()                    내 토끼가 맞았을 때 화면 가장자리 빨갛게 번쩍
//   hud.show(참/거짓)                     정보판 보이기 (body 에 hud-on 을 붙여 마우스 화살표를 숨김)
//   hud.setSound(켜짐)                    소리 단추 모양 맞추기
//   hud.pulseCrosshair()                 조준점 톡 (쏠 때 불러 주면 손맛이 좋아짐, 없어도 됨)
//   hud.element
//
// 글자는 fight.html 의 #hud, 모양·색은 css/fight-hud.css (위쪽 정보판), css/fight-weapons.css (무기 칸),
// css/fight-fx.css (조준점·빨간 테두리) 에서 바꿉니다.

const EAR_BLOCKS = 8; // 얼굴 아이콘의 귀 블록 수 (fight.html 의 귀 <i> 개수와 같아야 함)
// 귀 블록이 터지는 차례: 왼쪽 끝 → 오른쪽 끝 → … (게임 속 토끼처럼 끝에서부터 번갈아)
const EAR_POP_ORDER = [['l', 3], ['r', 3], ['l', 2], ['r', 2], ['l', 1], ['r', 1], ['l', 0], ['r', 0]];
const HP_LOW = 0.3; // 이 비율 아래면 빨간 체력·두근두근 테두리
const HP_MID = 0.6; // 이 비율 아래면 주황 체력
const AMMO_LOW = 3; // 탄이 이만큼 이하면 숫자가 빨갛게
const KICK_MS = 70; // 조준점이 톡 커졌다 돌아오는 시간 (밀리초)
const BUZZ_MS = 30; // 휴대폰에서 맞았을 때 진동 (안드로이드만, 0 이면 끔)

export function createHud({ sounds = null } = {}) {
  const el = (id) => document.getElementById(id);
  const ui = {
    root: el('hud'),
    me: el('hudMe'),
    hpTrack: el('hudHpTrack'),
    hpFill: el('hudHpFill'),
    hpLag: el('hudHpLag'),
    hpText: el('hudHpText'),
    foes: el('hudFoes'),
    foeAlive: el('hudFoeAlive'),
    foeTotal: el('hudFoeTotal'),
    ammo: el('hudAmmo'),
    magazine: el('hudMagazine'),
    pips: el('hudAmmoPips'),
    roll: el('hudRoll'),
    sound: el('soundBtn'),
    crosshair: el('crosshair'),
    vignette: el('hurtVignette'),
    touchSwap: el('touchSwap'),
    touchAttack: el('touchAttack'),
    touchAmmo: el('touchAmmo'),
    touchRoll: document.querySelector('.touch-btn--roll'),
    touchReload: document.querySelector('.touch-btn--reload'),
  };
  const slots = [...document.querySelectorAll('.weapon-slot[data-weapon]')];
  const blasterSlot = slots.find((slot) => slot.dataset.weapon === 'blaster') ?? null;
  const earBlocks = EAR_POP_ORDER.map(([side, index]) => ui.me?.querySelectorAll(`.ear--${side} i`)[index] ?? null);

  const last = { hp: null, max: null, ratio: 1, alive: null, total: null, weapon: null, ammo: null, magazine: null, reloading: null, reload: -1, low: null, roll: -1 };
  let pips = [];
  let kickTimer = 0;

  // ── 체력 ──
  function setHp(hp, max) {
    const value = Math.max(0, Math.ceil(hp));
    if (value === last.hp && max === last.max) return;
    const ratio = max > 0 ? Math.min(1, Math.max(0, hp / max)) : 0;
    const healing = last.hp !== null && value > last.hp;
    const hurt = last.hp !== null && value < last.hp;
    last.hp = value;
    last.max = max;
    last.ratio = ratio;

    ui.hpText.textContent = String(value);
    ui.hpTrack.setAttribute('aria-valuenow', String(value));
    ui.hpTrack.setAttribute('aria-valuemax', String(max));
    ui.hpTrack.classList.toggle('is-healing', healing);
    const width = `${(ratio * 100).toFixed(1)}%`;
    ui.hpFill.style.width = width;
    ui.hpLag.style.width = width;
    ui.me.dataset.level = ratio <= HP_LOW ? 'low' : ratio <= HP_MID ? 'mid' : 'ok';
    ui.vignette?.classList.toggle('is-low', ratio <= HP_LOW && value > 0);
    if (hurt) replay(ui.me, 'is-hit');
    setEarBlocks(Math.ceil(EAR_BLOCKS * ratio));
  }

  // 남은 귀 블록 수만큼만 보이기 (터질 때 톡 날아가고, 당근 먹으면 다시 붙음)
  function setEarBlocks(visible) {
    earBlocks.forEach((block, order) => {
      if (!block) return;
      const gone = order < EAR_BLOCKS - visible;
      if (gone === block.classList.contains('is-gone')) return;
      if (gone) block.classList.remove('is-back'); // 다시 붙은 표시를 떼야 톡 날아가는 움직임이 이김 (안 떼면 귀가 그대로 보임)
      block.classList.toggle('is-gone', gone);
      if (!gone) replay(block, 'is-back');
    });
  }

  // ── 남은 미친토끼 ──
  function setEnemies(alive, total) {
    if (alive === last.alive && total === last.total) return;
    const fewer = last.alive !== null && alive < last.alive;
    last.alive = alive;
    last.total = total;
    ui.foeAlive.textContent = String(alive);
    ui.foeTotal.textContent = String(total);
    ui.foes.dataset.cleared = String(alive === 0);
    ui.foes.setAttribute('aria-label', `남은 미친토끼 ${alive}마리 (전체 ${total}마리)`);
    if (fewer) replay(ui.foes, 'is-bump');
  }

  // ── 무기 ──
  function setWeapon({ id, name, ammo, magazine, reloading = false, reloadProgress = 0 } = {}) {
    if (id && id !== last.weapon) {
      last.weapon = id;
      for (const slot of slots) {
        const active = slot.dataset.weapon === id;
        slot.dataset.active = String(active);
        const label = slot.querySelector('.weapon-name');
        if (active && name && label) label.textContent = name; // 무기 이름은 fightConfig.js 의 weapons.*.name
      }
      if (ui.touchSwap) ui.touchSwap.dataset.weapon = id;
      if (ui.touchAttack) ui.touchAttack.dataset.weapon = id;
      ui.crosshair?.classList.toggle('is-sword', id === 'sword');
    }
    if (Number.isFinite(magazine) && magazine !== last.magazine) {
      last.magazine = magazine;
      if (ui.magazine) ui.magazine.textContent = String(magazine);
      buildPips(magazine);
      last.ammo = null; // 알갱이를 새로 만들었으니 다시 채움
    }
    if (Number.isFinite(ammo) && ammo !== last.ammo) {
      last.ammo = ammo;
      if (ui.ammo) ui.ammo.textContent = String(ammo);
      if (ui.touchAmmo) ui.touchAmmo.textContent = String(ammo);
      pips.forEach((pip, index) => pip.classList.toggle('is-empty', index >= ammo));
    }
    const isReloading = !!reloading;
    const low = Number.isFinite(ammo) && ammo <= AMMO_LOW && !isReloading;
    if (low !== last.low) {
      last.low = low;
      blasterSlot?.classList.toggle('is-low', low);
      ui.touchAttack?.classList.toggle('is-low', low);
    }
    if (isReloading !== last.reloading) {
      last.reloading = isReloading;
      for (const node of [blasterSlot, ui.touchAttack, ui.touchReload, ui.crosshair]) node?.classList.toggle('is-reloading', isReloading);
      if (isReloading && ui.touchAmmo) ui.touchAmmo.textContent = '…';
      else if (ui.touchAmmo && Number.isFinite(ammo)) ui.touchAmmo.textContent = String(ammo);
    }
    const progress = isReloading ? Math.round(Math.min(1, Math.max(0, reloadProgress)) * 50) / 50 : 0;
    if (progress !== last.reload) {
      last.reload = progress;
      blasterSlot?.style.setProperty('--reload', String(progress));
      ui.crosshair?.style.setProperty('--reload', String(progress));
    }
  }

  function buildPips(count) {
    if (!ui.pips) return;
    const nodes = [];
    for (let i = 0; i < count; i++) nodes.push(document.createElement('i'));
    ui.pips.replaceChildren(...nodes);
    pips = nodes;
  }

  // ── 구르기 준비 ──
  function setRollReady(value) {
    const ready = Math.round(Math.min(1, Math.max(0, value)) * 40) / 40;
    if (ready === last.roll) return;
    last.roll = ready;
    for (const node of [ui.roll, ui.touchRoll]) {
      if (!node) continue;
      node.style.setProperty('--ready', String(ready));
      node.dataset.ready = String(ready >= 1);
    }
  }

  // ── 맞았을 때 화면 가장자리 번쩍 ──
  function flashDamage() {
    if (ui.vignette) replay(ui.vignette, 'is-hit');
    if (BUZZ_MS && document.body.classList.contains('touch-mode')) safely(() => navigator.vibrate?.(BUZZ_MS));
  }

  // ── 조준점: 마우스를 따라다님 ──
  function onPointerMove(event) {
    if (event.pointerType !== 'mouse' || !ui.crosshair) return;
    ui.crosshair.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    // 단추 위에서는 보통 마우스 화살표만 (화살표가 두 개 보이지 않게)
    ui.crosshair.classList.toggle('is-away', !!event.target?.closest?.('button, a, .overlay'));
  }

  function onPointerOut(event) {
    if (!event.relatedTarget) ui.crosshair?.classList.add('is-away'); // 마우스가 창 밖으로 나감
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerMove, { passive: true });
  document.addEventListener('pointerout', onPointerOut, { passive: true });
  ui.crosshair?.classList.add('is-away'); // 마우스를 움직이기 전에는 숨김

  function pulseCrosshair() {
    if (!ui.crosshair) return;
    ui.crosshair.classList.add('is-kick');
    clearTimeout(kickTimer);
    kickTimer = setTimeout(() => ui.crosshair.classList.remove('is-kick'), KICK_MS);
  }

  // ── 소리 단추 ──
  function setSound(on) {
    ui.sound?.setAttribute('aria-pressed', String(!!on));
  }

  ui.sound?.addEventListener('click', (event) => {
    if (event.detail > 0) ui.sound.blur(); // 마우스·손가락으로 눌렀으면 초점을 치움 (나중에 Space 가 단추를 누르지 않게)
    if (!sounds) return;
    const on = sounds.setEnabled(!sounds.isEnabled());
    setSound(on);
    if (on) sounds.play('click');
  });

  function show(on) {
    ui.root.hidden = !on;
    if (ui.crosshair) ui.crosshair.hidden = !on;
    document.body.classList.toggle('hud-on', !!on);
    if (sounds) setSound(sounds.isEnabled());
  }

  return {
    setHp,
    setEnemies,
    setWeapon,
    setRollReady,
    flashDamage,
    show,
    setSound,
    pulseCrosshair,
    element: ui.root,
  };
}

// CSS 움직임을 처음부터 다시 (같은 이름표를 뗐다 붙임)
function replay(node, className) {
  node.classList.remove(className);
  void node.offsetWidth; // 브라우저가 '뗀 상태'를 한 번 그리게 함
  node.classList.add(className);
}

function safely(action) {
  try {
    return action();
  } catch {
    return undefined;
  }
}
