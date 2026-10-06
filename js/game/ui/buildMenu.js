// 타워 · 성 부품 메뉴
// 빈 타워 자리를 누르면 '타워 짓기' 목록이, 지어 둔 타워를 누르면 '강화 / 팔기' 메뉴가 뜹니다.
// 성 둘레 노란 빈 자리를 누르면 '성 부품 붙이기' 목록이, 붙여 둔 부품을 누르면 '강화' 메뉴가 뜹니다 (부품은 팔 수 없음).
// 넓은 화면에서는 누른 자리 옆에 말풍선처럼, 좁은 화면(휴대폰)에서는 아래에서 올라오는 판으로 보입니다.
// 문구와 틀은 game.html 의 #buildMenu 와 #towerChoiceTemplate, 모양은 css/game.css 의 '7. 타워 · 성 부품 메뉴' 에 있습니다.
// 타워 이름·설명·값은 gameConfig.js 의 towers, 부품은 castleParts 에서 가져옵니다.
//
//   const menu = createBuildMenu({ towerTypes, onBuild(typeId), onUpgrade(), onSell(),
//                                  onBuildPart(typeId), onUpgradePart(), onClose() })
//   menu.openForPad({ screen, gold })                                    빈 타워 자리 메뉴 (screen: 화면 위치 { x, y })
//   menu.openForTower({ tower, screen, gold, upgradeCost, sellValue })   타워 메뉴
//        tower: { typeId, name, level, maxLevel, built, damage, range, fireInterval }
//        upgradeCost: 강화 비용 (강화할 수 없으면 null)
//   menu.openForSocket({ screen, gold, kindLabel, options })             성 둘레 빈 자리 메뉴
//        kindLabel: '성 모서리' 같은 자리 이름, options: [{ typeId, name, description, cost, free }]
//        free 가 true 면 값 대신 '무료' 표시 (보상 카드로 받은 무료 부품)
//   menu.openForPart({ part, screen, gold, upgradeCost })                붙여 둔 부품 메뉴
//        part: { typeId, name, level, maxLevel, built, description, effect, nextEffect }
//   menu.reposition(screen)   자리가 화면에서 움직이면 따라가기 (매 장면 불러도 가벼움)
//   menu.setGold(gold)        골드가 바뀌면 살 수 있는 것을 다시 표시
//   menu.close()
//   menu.isOpen               열려 있는지
// Esc 키를 누르거나 메뉴 바깥을 살짝 누르면 onClose() 를 부릅니다. (끌어서 화면을 돌릴 때는 닫지 않음)

const NARROW_QUERY = '(max-width: 639px)'; // 이보다 좁으면 아래 판으로 보임 (css/game.css 의 같은 숫자와 맞출 것)
const GAP_PX = 30; // 누른 자리와 말풍선 사이 거리
const EDGE_PX = 10; // 화면 가장자리와 띄우는 거리
const TAP_MOVE_PX = 8; // 이만큼 넘게 움직이면 '누르기'가 아니라 '끌기'로 봄

// 메뉴 종류마다 화면 읽기 프로그램에 알려 줄 이름
const MENU_LABELS = {
  pad: '타워 짓기 메뉴',
  tower: '타워 메뉴',
  socket: '성 부품 메뉴',
  part: '성 부품 메뉴',
};

export function createBuildMenu({ towerTypes, onBuild, onUpgrade, onSell, onBuildPart, onUpgradePart, onClose }) {
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
    socketPanel: el('socketPanel'),
    socketKind: el('socketKind'),
    partChoices: el('partChoices'),
    partPanel: el('partPanel'),
    partIcon: el('partIcon'),
    partName: el('partName'),
    partLevel: el('partLevel'),
    partMaxLevel: el('partMaxLevel'),
    partLevelStuds: el('partLevelStuds'),
    partEffect: el('partEffect'),
    partNextLine: el('partNextLine'),
    partNextEffect: el('partNextEffect'),
    partUpgradeBtn: el('partUpgradeBtn'),
    partUpgradeCost: el('partUpgradeCost'),
    partUpgradeShort: el('partUpgradeShort'),
  };
  const panels = { pad: ui.padPanel, tower: ui.towerPanel, socket: ui.socketPanel, part: ui.partPanel };
  // 강화 단추가 있는 메뉴: 상태 표시를 같은 방법으로 함
  const upgradeParts = {
    tower: { panel: ui.towerPanel, button: ui.upgradeBtn, short: ui.upgradeShort },
    part: { panel: ui.partPanel, button: ui.partUpgradeBtn, short: ui.partUpgradeShort },
  };
  const narrow = window.matchMedia(NARROW_QUERY);

  const state = {
    mode: null, // null(닫힘) | 'pad' | 'tower' | 'socket' | 'part'
    gold: 0,
    upgradeCost: null,
    item: null, // 메뉴에 보이는 타워나 부품 정보
    screen: null,
    size: { width: 0, height: 0 },
    placed: { x: NaN, y: NaN, tail: NaN, side: '' },
  };

  // 목록 한 줄 만들기 (타워와 성 부품이 같은 틀을 씀)
  // 메뉴가 막 열린 직후(휴대폰에서 자리를 누른 손가락이 떨어지는 순간)의 눌림은 무시 → 실수로 사지지 않게
  const OPEN_GUARD_MS = 350;
  let openedAt = 0;
  function guarded(action) {
    return () => {
      if (performance.now() - openedAt < OPEN_GUARD_MS) return;
      action();
    };
  }

  function createChoice(typeId, kind, onPick) {
    const item = ui.choiceTemplate.content.firstElementChild.cloneNode(true);
    const button = item.querySelector('.tower-choice');
    const icon = item.querySelector('.block-icon');
    button.dataset[kind] = typeId;
    icon.dataset[kind] = typeId;
    button.addEventListener('click', guarded(() => onPick?.(typeId)));
    return {
      typeId,
      item,
      button,
      name: item.querySelector('.choice-name'),
      desc: item.querySelector('.choice-desc'),
      costText: item.querySelector('.choice-cost'),
      missing: item.querySelector('.choice-missing-value'),
      cost: 0,
      free: false,
      affordable: null,
    };
  }

  // 빈 자리 메뉴의 타워 목록 (한 번만 만듦)
  const towerChoices = Object.entries(towerTypes).map(([typeId, type]) => {
    const choice = createChoice(typeId, 'tower', onBuild);
    choice.name.textContent = type.name;
    choice.desc.textContent = type.description ?? '';
    choice.costText.textContent = type.cost;
    choice.cost = type.cost;
    ui.choices.append(choice.item);
    return choice;
  });

  // 성 부품 목록 (자리 종류마다 다르므로 열 때마다 채움. 한 번 만든 줄은 다시 씀)
  const partRows = new Map();
  let partChoices = [];
  let shownPartIds = '';

  ui.upgradeBtn.addEventListener('click', guarded(() => onUpgrade?.()));
  ui.sellBtn.addEventListener('click', guarded(() => onSell?.()));
  ui.partUpgradeBtn.addEventListener('click', guarded(() => onUpgradePart?.()));
  ui.close.addEventListener('click', requestClose);

  // ── 열기 ──
  function setMode(mode) {
    state.mode = mode;
    for (const [name, panel] of Object.entries(panels)) panel.hidden = name !== mode;
    const label = MENU_LABELS[mode];
    if (label && ui.root.getAttribute('aria-label') !== label) ui.root.setAttribute('aria-label', label);
  }

  function openForPad({ screen, gold }) {
    setMode('pad');
    state.item = null;
    for (const choice of towerChoices) choice.affordable = null;
    applyGold(gold);
    show(screen);
  }

  function openForTower({ tower, screen, gold, upgradeCost, sellValue }) {
    setMode('tower');
    state.item = tower;
    state.upgradeCost = upgradeCost ?? null;

    ui.towerIcon.dataset.tower = tower.typeId;
    ui.towerName.textContent = tower.name;
    ui.towerLevel.textContent = tower.level;
    ui.towerMaxLevel.textContent = tower.maxLevel;
    renderLevelStuds(ui.towerLevelStuds, tower.level, tower.maxLevel);
    ui.towerDamage.textContent = formatNumber(tower.damage);
    ui.towerRange.textContent = formatNumber(tower.range);
    ui.towerRate.textContent = tower.fireInterval > 0 ? formatNumber(1 / tower.fireInterval) : '-';
    ui.sellValue.textContent = sellValue;
    if (state.upgradeCost !== null) ui.upgradeCost.textContent = state.upgradeCost;
    applyGold(gold);
    show(screen);
  }

  function openForSocket({ screen, gold, kindLabel, options }) {
    setMode('socket');
    state.item = null;
    ui.socketKind.textContent = kindLabel || '성 둘레';
    renderPartChoices(options ?? []);
    applyGold(gold);
    show(screen);
  }

  function openForPart({ part, screen, gold, upgradeCost }) {
    setMode('part');
    state.item = part;
    state.upgradeCost = upgradeCost ?? null;

    ui.partIcon.dataset.part = part.typeId;
    ui.partName.textContent = part.name;
    ui.partLevel.textContent = part.level;
    ui.partMaxLevel.textContent = part.maxLevel;
    renderLevelStuds(ui.partLevelStuds, part.level, part.maxLevel);
    ui.partEffect.textContent = part.effect || part.description || '';
    ui.partNextEffect.textContent = part.nextEffect ?? '';
    ui.partNextLine.hidden = !part.nextEffect;
    if (state.upgradeCost !== null) ui.partUpgradeCost.textContent = state.upgradeCost;
    applyGold(gold);
    show(screen);
  }

  function renderPartChoices(options) {
    partChoices = options.map((option) => {
      let choice = partRows.get(option.typeId);
      if (!choice) {
        choice = createChoice(option.typeId, 'part', onBuildPart);
        partRows.set(option.typeId, choice);
      }
      const cost = option.free ? 0 : Math.max(0, Math.round(option.cost ?? 0));
      setText(choice.name, option.name ?? option.typeId);
      setText(choice.desc, option.description ?? '');
      setText(choice.costText, String(cost));
      choice.cost = cost;
      choice.free = Boolean(option.free);
      choice.button.classList.toggle('is-free', choice.free);
      choice.affordable = null; // 값이 바뀌었을 수 있으니 다시 계산
      return choice;
    });
    // 목록이 그대로면 줄을 다시 끼우지 않음 (누르고 있던 단추의 초점이 사라지지 않게)
    const ids = partChoices.map((choice) => choice.typeId).join(',');
    if (ids !== shownPartIds) {
      shownPartIds = ids;
      ui.partChoices.replaceChildren(...partChoices.map((choice) => choice.item));
    }
  }

  function renderLevelStuds(container, level, maxLevel) {
    const studs = [];
    for (let i = 1; i <= maxLevel; i++) {
      const stud = document.createElement('span');
      stud.className = i <= level ? 'level-stud is-on' : 'level-stud';
      studs.push(stud);
    }
    container.replaceChildren(...studs);
  }

  function show(screen) {
    const wasOpen = !ui.root.hidden;
    if (!wasOpen) openedAt = performance.now();
    ui.root.hidden = false;
    measure();
    state.placed.x = NaN; // 새로 열면 위치를 꼭 다시 계산
    place(screen);
    if (!wasOpen) ui.root.focus({ preventScroll: true });
  }

  function close() {
    if (state.mode === null && ui.root.hidden) return;
    state.mode = null;
    state.item = null;
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
    const choices = state.mode === 'pad' ? towerChoices : state.mode === 'socket' ? partChoices : null;
    if (choices) {
      for (const choice of choices) {
        const affordable = choice.free || gold >= choice.cost;
        if (!affordable) choice.missing.textContent = choice.cost - gold;
        if (affordable === choice.affordable) continue;
        choice.affordable = affordable;
        choice.button.disabled = !affordable;
        changed = true;
      }
      return changed;
    }
    const upgrade = upgradeParts[state.mode];
    if (upgrade) {
      const status = upgradeStatus(gold);
      if (upgrade.panel.dataset.upgrade !== status) {
        upgrade.panel.dataset.upgrade = status;
        changed = true;
      }
      upgrade.button.disabled = status !== 'ready';
      if (status === 'short') upgrade.short.textContent = state.upgradeCost - gold;
    }
    return changed;
  }

  // 'ready' 강화 가능 | 'short' 골드 부족 | 'max' 최고 레벨 | 'wait' 아직 짓는 중
  function upgradeStatus(gold) {
    const item = state.item;
    if (state.upgradeCost === null) return item && item.level >= item.maxLevel ? 'max' : 'wait';
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
    let x = clamp(point.x - width / 2, EDGE_PX, viewW - width - EDGE_PX);
    if (side === 'none') {
      // 위아래 모두 자리가 없으면(가로로 눕힌 휴대폰) 누른 곳 옆에 띄워서 타워를 가리지 않게 함
      x = point.x + GAP_PX + width <= viewW - EDGE_PX ? point.x + GAP_PX : point.x - GAP_PX - width;
      x = clamp(x, EDGE_PX, viewW - width - EDGE_PX);
      y = clamp(point.y - height / 2, EDGE_PX, viewH - height - EDGE_PX);
    }
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
    openForSocket,
    openForPart,
    close,
    reposition,
    setGold,
    get isOpen() {
      return state.mode !== null;
    },
  };
}

// 글자가 같으면 화면을 고치지 않음
function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

// 6 → '6', 8.7000001 → '8.7'
function formatNumber(value) {
  return String(Math.round(value * 10) / 10);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
