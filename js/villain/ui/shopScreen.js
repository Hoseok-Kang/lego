// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 부품 상점
// 괴수에 붙일 공격 부품(집게발 · 불 뿜는 입 · 돌진 뿔)을 돈으로 삽니다. 한 번 사면 모든 괴수에 붙일 수 있어요.
// 이 화면은 보여 주기와 '사기' 누름 알리기만 합니다. 돈을 빼고 저장하는 일은 부른 쪽(game.js)이 합니다.
//
// 쓰는 법
//   const shop = createShopScreen(root, {
//     onBuy(type) → true | false | { ok, message }   사기를 눌렀을 때 (돈이 충분할 때만 불림). 성공하면 '샀어요!' 효과
//     onBack(),                                       소굴로
//   })
//   shop.render({ money, ownedParts, available?, locks?, slots? })   내용 새로 그리기
//       available: 지금 살 수 있는 부품 목록 (없으면 모두). 못 사는 부품은 잠긴 카드 + locks[부품] 글자 ('연구실 1단계에 열려요')
//       slots: 괴수 한 마리에 붙일 수 있는 부품 수 (소굴 효과 반영, 없으면 villainConfig 의 parts.slots)
//   shop.show(state?) / shop.hide() / shop.el
//
// 부품 이름 · 값 · 설명 · 세기는 js/villain/villainConfig.js 의 parts.types 에서 바꿉니다.
// 글자는 아래 TEXT, 모양은 css/villain-lair.css (상점 부분) 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { partIconURL } from '../draw/partIcons.js';
import { el, escapeHTML, money, coin, countTo, bump, toast } from './uiKit.js';
import { icon } from './uiIcons.js';

const TEXT = {
  title: '부품 상점',
  lead: '한 번 사면 어느 괴수에게나 붙일 수 있어요',
  back: '소굴로',
  buy: '사기',
  owned: '가지고 있어요',
  free: '처음부터 있어요',
  bought: '샀어요!',
  attach: '붙일 때마다',
  poor: (n) => `돈이 ${money(n)} 모자라요. 마을을 부숴서 벌어 와요`,
  slots: (n) => `괴수 한 마리에 부품을 ${n}개까지 붙일 수 있어요`,
  soon: '새 부품 준비 중',
  soonHint: '악당 연구소가 열심히 만들고 있어요',
  locked: '아직 못 사요',
  lockedHint: '연구실을 지으면 열려요',
  power: '힘',
  speed: '빠르기',
  reach: '거리',
};

const PIPS = 5; // 세기 막대 칸 수

// 1초 동안 주는 피해 (쉬는 시간까지 넣어서)
function powerOf(part) {
  const duty = part.burstSeconds ? part.burstSeconds / (part.burstSeconds + (part.restSeconds ?? 0)) : 1;
  return (part.damage / part.interval) * duty;
}

function pips(value, max) {
  const filled = Math.max(1, Math.min(PIPS, Math.round((value / max) * PIPS)));
  return `<span class="pips" aria-label="${filled} / ${PIPS}">${'<i class="on"></i>'.repeat(filled)}${'<i></i>'.repeat(PIPS - filled)}</span>`;
}

export function createShopScreen(root, { onBuy, onBack } = {}) {
  const screen = el(`
    <section class="shop vt-screen" hidden aria-label="${TEXT.title}">
      <header class="shop-head">
        <button type="button" class="vt-btn" data-act="back">${icon('back')}<span>${TEXT.back}</span></button>
        <div class="shop-title"><h1>${icon('shop')}${TEXT.title}</h1><p>${TEXT.lead}</p></div>
        <div class="vt-money" title="가진 돈">${icon('coin')}<b data-money>0</b></div>
      </header>
      <div class="shop-list" data-list tabindex="-1"></div>
      <p class="shop-foot" data-foot>${TEXT.slots(VILLAIN.parts.slots)}</p>
    </section>`);
  root.append(screen);

  const moneyEl = screen.querySelector('[data-money]');
  const list = screen.querySelector('[data-list]');
  let state = { money: 0, ownedParts: [], available: null, locks: {}, slots: VILLAIN.parts.slots };
  const isLocked = (type) => !state.ownedParts.includes(type) && Array.isArray(state.available) && !state.available.includes(type);
  let firstRender = true;

  function cardHTML([type, part], index, all) {
    const owned = state.ownedParts.includes(type);
    const locked = isLocked(type);
    const poor = !owned && !locked && part.price > state.money;
    const maxPower = Math.max(...all.map(([, p]) => powerOf(p)));
    const maxSpeed = Math.max(...all.map(([, p]) => 1 / p.interval));
    const maxRange = Math.max(...all.map(([, p]) => p.range));
    const action = owned
      ? `<div class="shop-owned">${icon('check')}<span>${part.price > 0 ? TEXT.owned : TEXT.free}</span></div>`
      : locked
      ? `<button type="button" class="vt-btn shop-locked" data-act="locked">${icon('lock')}<span>${escapeHTML(state.locks?.[type] ?? TEXT.lockedHint)}</span></button>`
      : `<button type="button" class="vt-btn vt-btn--go shop-buy" data-act="buy" ${poor ? 'aria-disabled="true"' : ''}><span>${TEXT.buy}</span>${coin(part.price)}</button>`;
    return `
      <article class="pcard${owned ? ' is-owned' : ''}${poor ? ' is-poor' : ''}${locked ? ' is-locked' : ''}" data-type="${type}" style="--i:${index}">
        <div class="pcard-pic"><img src="${partIconURL(type, 144)}" alt="" draggable="false"></div>
        <div class="pcard-body">
          <h2 class="pcard-name">${escapeHTML(part.name)}</h2>
          <p class="pcard-desc">${escapeHTML(part.desc)}</p>
          <dl class="pcard-stats">
            <div><dt>${TEXT.power}</dt><dd>${pips(powerOf(part), maxPower)}</dd></div>
            <div><dt>${TEXT.speed}</dt><dd>${pips(1 / part.interval, maxSpeed)}</dd></div>
            <div><dt>${TEXT.reach}</dt><dd>${pips(part.range, maxRange)}</dd></div>
          </dl>
          <p class="pcard-attach">${TEXT.attach} ${coin(part.cost, { sign: true })}</p>
        </div>
        <div class="pcard-action">${action}</div>
      </article>`;
  }

  function render(next = {}) {
    state = { ...state, ...next };
    state.ownedParts = state.ownedParts ?? [];
    screen.querySelector('[data-foot]').textContent = TEXT.slots(state.slots ?? VILLAIN.parts.slots);
    countTo(moneyEl, state.money, { from: firstRender ? state.money : null });
    const entries = Object.entries(VILLAIN.parts.types);
    const scroll = list.scrollTop;
    list.innerHTML =
      entries.map(cardHTML).join('') +
      `<article class="pcard pcard--soon" style="--i:${entries.length}"><div class="pcard-pic">${icon('lock')}</div><div class="pcard-body"><h2 class="pcard-name">${TEXT.soon}</h2><p class="pcard-desc">${TEXT.soonHint}</p></div></article>`;
    list.scrollTop = scroll;
    firstRender = false;
  }

  screen.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    if (button.dataset.act === 'back') return onBack?.();
    const card = button.closest('.pcard');
    const type = card?.dataset.type;
    if (button.dataset.act === 'locked') {
      bump(card, 'is-shake');
      toast(`${VILLAIN.parts.types[type]?.name ?? ''}: ${state.locks?.[type] ?? TEXT.lockedHint}`, { kind: 'bad' });
      return;
    }
    if (button.dataset.act !== 'buy') return;
    const part = VILLAIN.parts.types[type];
    const lack = part.price - state.money;
    if (lack > 0) {
      bump(card, 'is-shake');
      bump(screen.querySelector('.vt-money'), 'is-shake');
      toast(TEXT.poor(lack), { kind: 'bad' });
      return;
    }
    const answer = onBuy?.(type);
    const ok = typeof answer === 'object' && answer !== null ? !!answer.ok : answer !== false;
    if (!ok) {
      if (answer?.message) toast(answer.message, { kind: 'bad' });
      return;
    }
    // 부른 쪽이 render 를 다시 안 불러도 바로 '가진 것'으로 보이게
    if (!state.ownedParts.includes(type)) render({ ownedParts: [...state.ownedParts, type], money: state.money - part.price });
    const fresh = list.querySelector(`[data-type="${type}"]`);
    fresh?.insertAdjacentHTML('beforeend', `<span class="pcard-stamp">${TEXT.bought}</span>`);
    bump(fresh, 'is-bought');
    toast(`${part.name}: ${TEXT.bought} 괴수를 고쳐서 붙여 보세요`, { kind: 'good' });
  });

  return {
    el: screen,
    render,
    show(next) {
      screen.hidden = false;
      if (next) render(next);
      bump(screen, 'is-enter');
    },
    hide() {
      screen.hidden = true;
    },
  };
}
