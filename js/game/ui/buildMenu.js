// 타워 메뉴
// 빈 타워 자리를 누르면 '타워 짓기' 목록이, 지어 둔 타워를 누르면 '강화 / 팔기' 메뉴가 뜹니다.
// 넓은 화면에서는 누른 자리 옆에 말풍선처럼, 좁은 화면(휴대폰)에서는 아래에서 올라오는 판으로 보입니다.
// 문구와 틀은 game.html 의 #buildMenu 와 #towerChoiceTemplate, 모양은 css/game.css 의 '7. 타워 메뉴' 에 있습니다.
// 타워 이름·설명·값은 gameConfig.js 의 towers 에서 가져옵니다.
//
//   const menu = createBuildMenu({ towerTypes, onBuild(typeId), onUpgrade(), onSell(), onClose() })
//   menu.openForPad({ screen, gold })                                    빈 자리 메뉴 (screen: 화면 위치 { x, y })
//   menu.openForTower({ tower, screen, gold, upgradeCost, sellValue })   타워 메뉴
//        tower: { typeId, name, level, maxLevel, built, damage, range, fireInterval }
//        upgradeCost: 강화 비용 (강화할 수 없으면 null)
//   menu.reposition(screen)   타워가 화면에서 움직이면 따라가기 (매 장면 불러도 가벼움)
//   menu.setGold(gold)        골드가 바뀌면 살 수 있는 것을 다시 표시
//   menu.close()
//   menu.isOpen               열려 있는지
// Esc 키를 누르거나 메뉴 바깥을 살짝 누르면 onClose() 를 부릅니다. (끌어서 화면을 돌릴 때는 닫지 않음)

const NARROW_QUERY = '(max-width: 639px)'; // 이보다 좁으면 아래 판으로 보임 (css/game.css 의 같은 숫자와 맞출 것)
const GAP_PX = 30; // 누른 자리와 말풍선 사이 거리
const EDGE_PX = 10; // 화면 가장자리와 띄우는 거리
const TAP_MOVE_PX = 8; // 이만큼 넘게 움직이면 '누르기'가 아니라 '끌기'로 봄

export function createBuildMenu({ towerTypes, onBuild, onUpgrade, onSell, onClose }) {
  const el = (id) => document.getElementById(id);
  const ui = {
    root: el('buildMenu'),
    close: el('buildMenuClose'),
    padPanel: el('padPanel'),
    choices: el('towerChoices'),
    choiceTemplate: el('towerChoiceTemplate'),
    towerPanel: el('towerPanel'),
    towerIcon: el('towerIcon'),
    towerName: el('towerName'),
    towerLevel: el('towerLevel'),
    towerMaxLevel: el('towerMaxLevel'),
    towerLevelStuds: el('towerLevelStuds'),
    towerDamage: el('towerDamage'),
    towerRange: el('towerRange'),
    towerRate: el('towerRate'),
    upgradeBtn: el('upgradeBtn'),
    upgradeCost: el('upgradeCost'),
    upgradeShort: el('upgradeShort'),
    sellBtn: el('sellBtn'),
    sellValue: el('sellValue'),
  };
  const narrow = window.matchMedia(NARROW_QUERY);

  const state = {
    mode: null, // null(닫힘) | 'pad' | 'tower'
    gold: 0,
    upgradeCost: null,
    tower: null,
    screen: null,
    size: { width: 0, height: 0 },
    placed: { x: NaN, y: NaN, tail: NaN, side: '' },
  };

  // 빈 자리 메뉴의 타워 목록 (한 번만 만듦)
  const choices = Object.entries(towerTypes).map(([typeId, type]) => {
    const item = ui.choiceTemplate.content.firstElementChild.cloneNode(true);
    const button = item.querySelector('.tower-choice');
    button.dataset.tower = typeId;
    item.querySelector('.block-icon').dataset.tower = typeId;
    item.querySelector('.choice-name').textContent = type.name;
    item.querySelector('.choice-desc').textContent = type.description ?? '';
    item.querySelector('.choice-cost').textContent = type.cost;
    button.addEventListener('click', () => onBuild?.(typeId));
    ui.choices.append(item);
    return { cost: type.cost, button, missing: item.querySelector('.choice-missing-value'), affordable: null };
  });

  ui.upgradeBtn.addEventListener('click', () => onUpgrade?.());
  ui.sellBtn.addEventListener('click', () => onSell?.());
  ui.close.addEventListener('click', requestClose);

  // ── 열기 ──
  function openForPad({ screen, gold }) {
    state.mode = 'pad';
    state.tower = null;
    ui.padPanel.hidden = false;
    ui.towerPanel.hidden = true;
    applyGold(gold);
    show(screen);
  }

  function openForTower({ tower, screen, gold, upgradeCost, sellValue }) {
    state.mode = 'tower';
    state.tower = tower;
    state.upgradeCost = upgradeCost ?? null;
    ui.padPanel.hidden = true;
    ui.towerPanel.hidden = false;

    ui.towerIcon.dataset.tower = tower.typeId;
    ui.towerName.textContent = tower.name;
    ui.towerLevel.textContent = tower.level;
    ui.towerMaxLevel.textContent = tower.maxLevel;
    renderLevelStuds(tower.level, tower.maxLevel);
    ui.towerDamage.textContent = formatNumber(tower.damage);
    ui.towerRange.textContent = formatNumber(tower.range);
    ui.towerRate.textContent = tower.fireInterval > 0 ? formatNumber(1 / tower.fireInterval) : '-';
    ui.sellValue.textContent = sellValue;
    if (state.upgradeCost !== null) ui.upgradeCost.textContent = state.upgradeCost;
    applyGold(gold);
    show(screen);
  }

  function renderLevelStuds(level, maxLevel) {
    const studs = [];
    for (let i = 1; i <= maxLevel; i++) {
      const stud = document.createElement('span');
      stud.className = i <= level ? 'level-stud is-on' : 'level-stud';
      studs.push(stud);
    }
    ui.towerLevelStuds.replaceChildren(...studs);
  }

  function show(screen) {
    const wasOpen = !ui.root.hidden;
    ui.root.hidden = false;
    measure();
    state.placed.x = NaN; // 새로 열면 위치를 꼭 다시 계산
    place(screen);
    if (!wasOpen) ui.root.focus({ preventScroll: true });
  }

  function close() {
    if (state.mode === null && ui.root.hidden) return;
    state.mode = null;
    state.tower = null;
    pointerDown = null;
    ui.root.hidden = true;
  }

  // 사용자가 닫으려 할 때: 게임에 알리고, 그래도 열려 있으면 직접 닫음
  function requestClose() {
    onClose?.();
    if (state.mode !== null) close();
  }

  // ── 골드에 따라 살 수 있는지 표시 ──
  function applyGold(gold) {
    state.gold = gold;
    let changed = false;
    if (state.mode === 'pad') {
      for (const choice of choices) {
        const affordable = gold >= choice.cost;
        if (!affordable) choice.missing.textContent = choice.cost - gold;
        if (affordable === choice.affordable) continue;
        choice.affordable = affordable;
        choice.button.disabled = !affordable;
        changed = true;
      }
    } else if (state.mode === 'tower') {
      const status = upgradeStatus(gold);
      if (ui.towerPanel.dataset.upgrade !== status) {
        ui.towerPanel.dataset.upgrade = status;
        changed = true;
      }
      ui.upgradeBtn.disabled = status !== 'ready';
      if (status === 'short') ui.upgradeShort.textContent = state.upgradeCost - gold;
    }
    return changed;
  }

  // 'ready' 강화 가능 | 'short' 골드 부족 | 'max' 최고 레벨 | 'wait' 아직 짓는 중
  function upgradeStatus(gold) {
    const tower = state.tower;
    if (state.upgradeCost === null) return tower && tower.level >= tower.maxLevel ? 'max' : 'wait';
    return gold >= state.upgradeCost ? 'ready' : 'short';
  }

  function setGold(gold) {
    if (gold === state.gold && state.mode !== null) return;
    if (state.mode === null) {
      state.gold = gold;
      return;
    }
    if (applyGold(gold)) {
      measure();
      state.placed.x = NaN;
      place(state.screen);
    }
  }

  // ── 위치 정하기 ──
  function measure() {
    state.size.width = ui.root.offsetWidth;
    state.size.height = ui.root.offsetHeight;
  }

  function place(screen) {
    if (screen) {
      // 매 장면 새 물건을 만들지 않도록 같은 칸에 덮어씀
      state.screen ??= { x: 0, y: 0 };
      state.screen.x = screen.x;
      state.screen.y = screen.y;
    }
    const placed = state.placed;
    if (narrow.matches) {
      // 아래 판: 위치는 css 가 정함
      if (placed.side !== 'sheet') {
        ui.root.style.translate = '';
        ui.root.dataset.side = 'sheet';
        placed.side = 'sheet';
        placed.x = NaN;
      }
      return;
    }
    const point = state.screen;
    if (!point) return;
    const { width, height } = state.size;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    // 먼저 위쪽에, 자리가 없으면 아래쪽에, 둘 다 없으면 화면 안으로 밀어 넣음
    let side = 'above';
    let y = point.y - GAP_PX - height;
    if (y < EDGE_PX) {
      side = 'below';
      y = point.y + GAP_PX;
      if (y + height > viewH - EDGE_PX) side = 'none';
    }
    y = clamp(y, EDGE_PX, viewH - height - EDGE_PX);
    const x = clamp(point.x - width / 2, EDGE_PX, viewW - width - EDGE_PX);
    const tail = clamp(point.x - x, 22, width - 22);

    const rx = Math.round(x);
    const ry = Math.round(y);
    const rt = Math.round(tail);
    if (rx === placed.x && ry === placed.y && rt === placed.tail && side === placed.side) return;
    placed.x = rx;
    placed.y = ry;
    placed.tail = rt;
    if (side !== placed.side) {
      placed.side = side;
      ui.root.dataset.side = side;
    }
    ui.root.style.translate = `${rx}px ${ry}px`;
    ui.root.style.setProperty('--tail-x', `${rt}px`);
  }

  function reposition(screen) {
    if (state.mode === null || !screen) return;
    if (narrow.matches && state.placed.side === 'sheet') return;
    place(screen);
  }

  const onViewChange = () => {
    if (state.mode === null) return;
    measure();
    state.placed.x = NaN;
    place(state.screen);
  };
  narrow.addEventListener('change', onViewChange);
  window.addEventListener('resize', onViewChange);

  // ── 바깥 누르기 · Esc 로 닫기 ──
  // 화면을 끌어서 돌리는 중에는 닫지 않고, 살짝 누르기만 했을 때 닫습니다.
  // (capture 단계에서 먼저 확인하므로, 다른 타워 자리를 누르면 '닫기 → 새로 열기' 순서가 됨)
  let pointerDown = null;
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (state.mode === null || ui.root.contains(event.target)) {
        pointerDown = null;
        return;
      }
      pointerDown = { id: event.pointerId, x: event.clientX, y: event.clientY };
    },
    true,
  );
  window.addEventListener(
    'pointerup',
    (event) => {
      const down = pointerDown;
      if (!down || down.id !== event.pointerId) return;
      pointerDown = null;
      if (state.mode === null) return;
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > TAP_MOVE_PX) return;
      requestClose();
    },
    true,
  );
  window.addEventListener('pointercancel', () => {
    pointerDown = null;
  });
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || state.mode === null) return;
    event.preventDefault();
    requestClose();
  });

  return {
    openForPad,
    openForTower,
    close,
    reposition,
    setGold,
    get isOpen() {
      return state.mode !== null;
    },
  };
}

// 6 → '6', 8.7000001 → '8.7'
function formatNumber(value) {
  return String(Math.round(value * 10) / 10);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
