// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 악당 소굴 (첫 화면)
// 가진 돈, 괴수 도감(카드 목록), 큰 단추(새 괴수 그리기 · 부품 상점), 쳐들어갈 마을 카드를 보여 줍니다.
// 이 화면은 보여 주기와 단추 누름 알리기만 합니다. 실제로 저장하고 화면을 바꾸는 일은 부른 쪽(game.js)이 합니다.
//
// 쓰는 법
//   const lair = createLairScreen(root, {
//     onRaid(design), onEdit(design), onCopy(design), onRemove(design),   카드 단추 (지우기는 이 화면이 먼저 "정말요?" 를 물어봄)
//     onNew(), onShop(),                                                  큰 단추
//     costOf(design), blocksOf(design),      출동 값 · 블록 수 계산 (보통 bestiary.designCost / countBlocks)
//     thumbOf(design) → 그림 주소,            카드 그림 (안 주면 도트 그림을 그대로 씀)
//   })
//   lair.render({ money, designs, stats: { raids, wins, bestPay }, welcome })   내용 새로 그리기 (welcome: 맨 위 한 줄 인사, 안 주면 기본)
//   lair.show(state?) / lair.hide() / lair.el
//
// 화면에 보이는 글자는 아래 TEXT 에서, 모양은 css/villain-lair.css 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { designThumbURL } from '../draw/pixelThumb.js';
import { partIconURL } from '../draw/partIcons.js';
import { el, escapeHTML, money, coin, countTo, bump, askDialog, toast } from './uiKit.js';
import { icon, MASCOT, HERO_FACE, TOWN_ART } from './uiIcons.js';

const TEXT = {
  welcome: '마을을 부술 괴수를 그려 보세요!',
  book: '괴수 도감',
  newMonster: '새 괴수 그리기',
  newHint: '도트 그림판에서 직접 그려요',
  shop: '부품 상점',
  shopHint: '집게발 · 불 · 뿔',
  raid: '출동',
  edit: '고치기',
  copy: '복사',
  remove: '지우기',
  builtIn: '기본',
  target: '쳐들어갈 마을',
  heroLabel: '지키는 영웅',
  poor: (n) => `돈이 ${money(n)} 모자라요. 더 작은 괴수를 보내 보세요`,
  removeAsk: (name) => `'${name}' 괴수를 지울까요?`,
  removeYes: '지울래요',
  removeNo: '아니요',
  empty: '아직 괴수가 없어요. 한 마리 그려 볼까요?',
};

export function createLairScreen(root, options = {}) {
  const { onRaid, onEdit, onCopy, onRemove, onNew, onShop } = options;
  const costOf = options.costOf ?? (() => 0);
  const blocksOf = options.blocksOf ?? ((d) => (d.cells ?? []).join('').replace(/\./g, '').length);
  const thumbOf = options.thumbOf ?? ((d) => designThumbURL(d, 160));
  const hero = VILLAIN.hero;
  const town = VILLAIN.town;

  const screen = el(`
    <section class="lair vt-screen" hidden aria-label="악당 소굴">
      <div class="lair-sky" aria-hidden="true"><i class="lair-moon"></i><i class="lair-star s1"></i><i class="lair-star s2"></i><i class="lair-star s3"></i><i class="lair-star s4"></i><i class="lair-drip d1"></i><i class="lair-drip d2"></i><i class="lair-drip d3"></i></div>
      <header class="lair-head">
        <h1 class="vt-logo">${MASCOT}<span class="vt-logo-a">악당</span><span class="vt-logo-b">타이쿤</span></h1>
        <div class="lair-wallet">
          <div class="vt-money" title="가진 돈">${icon('coin')}<b data-money>0</b></div>
          <button type="button" class="vt-btn vt-btn--icon" data-sound-toggle aria-label="소리">${icon('soundOn')}</button>
        </div>
      </header>
      <p class="lair-welcome" data-welcome></p>
      <aside class="lair-side">
        <section class="town-card" aria-label="${TEXT.target}">
          <div class="town-pic">${TOWN_ART}</div>
          <div class="town-info">
            <span class="vt-tag">${TEXT.target}</span>
            <h2 class="town-name">${escapeHTML(town.name)}</h2>
            <p class="town-pay">${icon('block')} 블록 하나 부수면 ${coin(town.payPerBlock)}</p>
          </div>
          <div class="town-hero">
            <span class="town-hero-face">${HERO_FACE}</span>
            <div>
              <span class="town-hero-name"><small>${TEXT.heroLabel}</small> ${escapeHTML(hero.name)} <em>이기면 ${coin(hero.payForWin, { sign: true })}</em></span>
              <p class="town-hero-hint">${escapeHTML(hero.hint)}</p>
            </div>
          </div>
          <p class="town-stats" data-stats></p>
        </section>
        <div class="lair-actions">
          <button type="button" class="vt-btn vt-btn--big vt-btn--main" data-act="new">${icon('pencil')}<span><b>${TEXT.newMonster}</b><small>${TEXT.newHint}</small></span></button>
          <button type="button" class="vt-btn vt-btn--big vt-btn--gold" data-act="shop">${icon('shop')}<span><b>${TEXT.shop}</b><small>${TEXT.shopHint}</small></span></button>
        </div>
      </aside>
      <main class="lair-book">
        <h2 class="lair-book-title">${TEXT.book} <small data-count></small></h2>
        <div class="lair-grid" data-grid tabindex="-1"></div>
      </main>
    </section>`);
  root.append(screen);

  const moneyEl = screen.querySelector('[data-money]');
  const grid = screen.querySelector('[data-grid]');
  const thumbs = new Map(); // 괴수 id + 고친 시각 → 그림 주소 (다시 안 그리게)
  let state = { money: 0, designs: [], stats: null };
  let firstRender = true;

  function thumb(design) {
    const key = `${design.id}:${design.updatedAt ?? 0}:${(design.parts ?? []).length}`;
    if (!thumbs.has(key)) {
      let url = '';
      try {
        url = thumbOf(design) || '';
      } catch {
        url = '';
      }
      if (!url) url = designThumbURL(design, 160);
      thumbs.set(key, url);
    }
    return thumbs.get(key);
  }

  function cardHTML(design, index) {
    const cost = costOf(design);
    const blocks = blocksOf(design);
    const hp = Math.round(blocks * VILLAIN.monster.hpPerBlock);
    const poor = cost > state.money;
    const parts = (design.parts ?? [])
      .map((p) => `<img class="mcard-part" src="${partIconURL(p.type, 54)}" alt="${escapeHTML(VILLAIN.parts.types[p.type]?.name ?? p.type)}" title="${escapeHTML(VILLAIN.parts.types[p.type]?.name ?? p.type)}">`)
      .join('');
    return `
      <article class="mcard${poor ? ' is-poor' : ''}" data-id="${escapeHTML(design.id)}" style="--i:${index}">
        <div class="mcard-pic">
          ${design.builtIn ? `<span class="vt-tag mcard-tag">${TEXT.builtIn}</span>` : ''}
          <img class="mcard-img" src="${thumb(design)}" alt="" draggable="false">
          <span class="mcard-parts">${parts}</span>
        </div>
        <h3 class="mcard-name">${escapeHTML(design.name || '이름 없는 괴수')}</h3>
        <p class="mcard-stats">
          <span class="vt-chip" title="블록 수">${icon('block')}${money(blocks)}</span>
          <span class="vt-chip vt-chip--hp" title="체력">${icon('heart')}${money(hp)}</span>
        </p>
        <button type="button" class="vt-btn vt-btn--go mcard-go" data-act="raid" ${poor ? 'aria-disabled="true"' : ''}>${icon('play')}<span>${TEXT.raid}</span>${coin(cost)}</button>
        <div class="mcard-tools">
          <button type="button" class="vt-btn vt-btn--mini" data-act="edit">${icon('pencil')}<span>${TEXT.edit}</span></button>
          <button type="button" class="vt-btn vt-btn--mini" data-act="copy">${icon('copy')}<span>${TEXT.copy}</span></button>
          ${design.builtIn ? '' : `<button type="button" class="vt-btn vt-btn--mini vt-btn--quiet-danger" data-act="remove">${icon('trash')}<span>${TEXT.remove}</span></button>`}
        </div>
      </article>`;
  }

  function render(next = {}) {
    state = { ...state, ...next };
    const designs = state.designs ?? [];
    countTo(moneyEl, state.money, { from: firstRender ? state.money : null });
    screen.querySelector('[data-welcome]').textContent = state.welcome ?? TEXT.welcome;
    screen.querySelector('[data-count]').textContent = designs.length ? `${designs.length}마리` : '';
    const stats = state.stats;
    const statsEl = screen.querySelector('[data-stats]');
    statsEl.hidden = !(stats && stats.raids > 0);
    if (stats) statsEl.innerHTML = `<span>출동 <b>${money(stats.raids)}</b>번</span><span>승리 <b>${money(stats.wins)}</b>번</span><span>최고 ${coin(stats.bestPay)}</span>`;
    const scroll = grid.scrollTop;
    grid.innerHTML =
      designs.map(cardHTML).join('') +
      `<button type="button" class="mcard mcard--new" data-act="new" style="--i:${designs.length}">${icon('plus')}<b>${TEXT.newMonster}</b>${designs.length ? '' : `<small>${TEXT.empty}</small>`}</button>`;
    grid.scrollTop = scroll;
    firstRender = false;
  }

  screen.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-act]');
    if (!button || !screen.contains(button)) return;
    const act = button.dataset.act;
    if (act === 'new') return onNew?.();
    if (act === 'shop') return onShop?.();
    const card = button.closest('.mcard');
    const design = (state.designs ?? []).find((d) => String(d.id) === card?.dataset.id);
    if (!design) return;
    if (act === 'raid') {
      const lack = costOf(design) - state.money;
      if (lack > 0) {
        bump(card, 'is-shake');
        bump(screen.querySelector('.vt-money'), 'is-shake');
        toast(TEXT.poor(lack), { kind: 'bad' });
        options.onPoor?.(design, lack);
        return;
      }
      onRaid?.(design);
    } else if (act === 'edit') onEdit?.(design);
    else if (act === 'copy') onCopy?.(design);
    else if (act === 'remove') {
      const yes = await askDialog(screen, { message: TEXT.removeAsk(design.name), yes: TEXT.removeYes, no: TEXT.removeNo, danger: true });
      if (yes) onRemove?.(design);
    }
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
