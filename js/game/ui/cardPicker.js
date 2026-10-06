// 웨이브 보상 카드 고르기
// 웨이브를 막으면 화면 가운데에 큰 카드 몇 장(보통 3장)이 뜨고, 한 장을 고르면 onPick(카드 id) 를 부릅니다.
// 넓은 화면에서는 가로로 나란히, 휴대폰에서는 위아래로 쌓여 보입니다. 뒤에서 땅이 넓어지는 모습이 비쳐 보입니다.
// 손가락·마우스로 누르거나, 키보드 숫자 1·2·3 또는 화살표로 옮긴 뒤 Enter 로 고를 수 있습니다.
// 문구와 틀은 game.html 의 #cardPicker 와 #rewardCardTemplate, 모양은 css/game.css 의 '10. 웨이브 보상 카드' 에 있습니다.
// 카드 이름·설명·효과는 gameConfig.js 의 cards 에서 정합니다.
//
//   const picker = createCardPicker({ onPick(cardId) })
//   picker.show(cards, { wave })   카드 보여 주기. cards: [{ id, name, description, category }]
//                                  (systems/cards.js 의 deck.draw 결과. category: 'tower' | 'castle' | 'gold' | 'skill')
//   picker.hide()                  닫기 (고른 뒤 게임이 부름)
//   picker.isOpen                  열려 있는지

const PICK_DELAY_MS = 450; // 카드가 뜬 직후 이 시간 동안은 누르기를 무시 (전장을 누르던 손가락이 실수로 고르지 않게)
const LEAVE_MS = 280; // 고른 뒤 카드가 사라지는 시간

// 카드 종류 이름 (카드 위쪽 띠에 보임). 색은 css/game.css 의 --card-tower 같은 이름에서 바꿉니다.
const CATEGORY_LABELS = {
  tower: '타워',
  castle: '성',
  gold: '돈',
  skill: '스킬',
};
const OTHER_LABEL = '보너스'; // 종류를 모를 때

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function createCardPicker({ onPick } = {}) {
  const el = (id) => document.getElementById(id);
  const ui = {
    root: el('cardPicker'),
    wave: el('cardPickerWave'),
    list: el('cardList'),
    template: el('rewardCardTemplate'),
  };

  const state = {
    open: false,
    cards: [],
    buttons: [],
    armedAt: 0, // 이 시각(ms)부터 고를 수 있음
    picked: false,
    leaveTimer: 0,
  };

  // ── 보여 주기 ──
  function show(cards, { wave } = {}) {
    const list = Array.isArray(cards) ? cards.filter(Boolean) : [];
    clearTimeout(state.leaveTimer);
    state.cards = list;
    state.picked = false;
    state.open = true;
    state.armedAt = now() + (reducedMotion.matches ? PICK_DELAY_MS / 2 : PICK_DELAY_MS);
    if (wave !== undefined && wave !== null) ui.wave.textContent = wave;
    state.buttons = list.map((card, index) => createCard(card, index));
    ui.list.style.setProperty('--count', String(Math.max(1, list.length)));
    ui.list.replaceChildren(...state.buttons.map((button) => button.parentElement));
    ui.root.classList.remove('is-leaving', 'is-picked');
    ui.root.hidden = false;
    // 키보드로 바로 고를 수 있게 첫 카드에 초점 (마우스·손가락으로 열린 경우 초점 테두리는 보이지 않음)
    state.buttons[0]?.focus({ preventScroll: true });
  }

  function createCard(card, index) {
    const item = ui.template.content.firstElementChild.cloneNode(true);
    const button = item.querySelector('.reward-card');
    const category = CATEGORY_LABELS[card.category] ? card.category : 'other';
    button.dataset.category = category;
    button.style.setProperty('--i', String(index));
    item.querySelector('.card-icon').dataset.category = category;
    item.querySelector('.card-category').textContent = CATEGORY_LABELS[category] ?? OTHER_LABEL;
    item.querySelector('.card-key').textContent = index + 1;
    item.querySelector('.card-name').textContent = card.name ?? '';
    item.querySelector('.card-desc').textContent = card.description ?? '';
    button.addEventListener('click', () => pick(index));
    return button;
  }

  // ── 고르기 ──
  function pick(index) {
    if (!state.open || state.picked || now() < state.armedAt) return;
    const card = state.cards[index];
    if (!card) return;
    state.picked = true;
    state.buttons.forEach((button, i) => button.classList.add(i === index ? 'is-chosen' : 'is-dropped'));
    ui.root.classList.add('is-picked');
    const accepted = onPick?.(card.id);
    // 게임이 받아들이지 않았는데(false) 아직 열려 있으면 다시 고를 수 있게 되돌림
    if (accepted === false && state.open) {
      state.picked = false;
      ui.root.classList.remove('is-picked');
      for (const button of state.buttons) button.classList.remove('is-chosen', 'is-dropped');
    }
  }

  // ── 닫기 ── (고른 카드가 살짝 튀어 오른 뒤 사라짐)
  function hide() {
    if (!state.open && ui.root.hidden) return;
    state.open = false;
    clearTimeout(state.leaveTimer);
    if (reducedMotion.matches || ui.root.hidden) {
      finishHide();
      return;
    }
    ui.root.classList.add('is-leaving');
    state.leaveTimer = setTimeout(finishHide, LEAVE_MS);
  }

  function finishHide() {
    if (state.open) return; // 그 사이에 다시 열렸으면 그대로 둠
    ui.root.hidden = true;
    ui.root.classList.remove('is-leaving', 'is-picked');
    ui.list.replaceChildren();
    state.buttons = [];
    state.cards = [];
  }

  // ── 키보드 ── 숫자로 바로 고르기, 화살표로 옮기기, Tab 은 카드 안에서만 돌기
  window.addEventListener('keydown', (event) => {
    if (!state.open || event.ctrlKey || event.metaKey || event.altKey) return;
    const buttons = state.buttons;
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement);
    if (event.key.length === 1 && event.key >= '1' && event.key <= '9') {
      const index = Number(event.key) - 1;
      if (index < buttons.length) {
        event.preventDefault();
        if (!event.repeat) {
          buttons[index].focus({ preventScroll: true });
          pick(index);
        }
      }
      return;
    }
    let next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % buttons.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = current < 0 ? buttons.length - 1 : (current - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else if (event.key === 'Tab') {
      next = event.shiftKey ? (current <= 0 ? buttons.length - 1 : current - 1) : current < 0 || current >= buttons.length - 1 ? 0 : current + 1;
    } else if (event.key === 'Escape') {
      event.preventDefault(); // 카드는 꼭 한 장 골라야 해서 Esc 로 닫지 않음
      return;
    }
    if (next === null) return;
    event.preventDefault();
    buttons[next].focus({ preventScroll: true });
  });

  return {
    show,
    hide,
    get isOpen() {
      return state.open;
    },
  };
}

function now() {
  return performance.now();
}
