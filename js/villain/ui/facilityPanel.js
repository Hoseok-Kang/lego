// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 시설 판 (소굴에서 시설을 눌렀을 때)
// 레벨, 지금 효과와 강화하면 바뀌는 효과, 이 시설이 함께하는 계책, 다음에 찾을 만한 계책 힌트,
// [강화 값] [옮기기] [팔기 (돌려받는 돈)] 단추를 보여 줍니다. 팔기는 이 판이 먼저 "정말요?" 를 물어봐요.
//
// 쓰는 법
//   const panel = createFacilityPanel({ onUpgrade(id), onMove(id), onSell(id), onClose(), refundOf(building, def)? })
//   panel.el
//   panel.render({ building, def, evaluation, schemes, schemesSeen, facilities, money })
//       building: { id, type, x, y, level }   def: 시설 정의 (facilities.js)
//       evaluation: lairSim.evaluate 결과 { schemes: [{ key, ownerIds, links:[[a,b]], count, effect }] }
//       schemes: 계책 정의 목록 (schemes.js)   schemesSeen: 한 번이라도 켜 본 계책 key 목록
//
// 팔 때 돌려받는 돈은 refundOf 가 없으면 '낸 돈 합계 × villainConfig.lair.sellRefund(없으면 0.5)' 로 셉니다.
// 글자는 아래 TEXT, 모양은 css/villain-lair2.css (.facpanel) 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { el, escapeHTML, money, coin, bump, toast, askDialog } from './uiKit.js';
import { art, artOf, lairIcon } from './lairArt.js';
import { describeEffect, effectChips, unlockLines, schemeOf, needChips, sheetHead, signature } from './lairKit.js';
import { L } from '../lang/lang.js';

const TEXT = L({
  ko: {
    panel: '시설',
    level: (n, max) => `${n} / ${max} 레벨`,
    now: '지금 효과',
    next: '강화하면',
    none: '효과 없음',
    unlocks: '레벨마다 열리는 것',
    schemes: '함께하는 계책',
    owner: '주인공',
    helper: '도우미',
    times: (n) => `×${n}`,
    noScheme: '아직 켜진 계책이 없어요. 옆에 다른 시설을 붙여 보세요!',
    hints: '이렇게 붙여 볼까요?',
    unknown: '???',
    beside: '옆에',
    upgrade: '강화',
    maxed: '최고 레벨!',
    move: '옮기기',
    sell: '팔기',
    noSell: '이 시설은 팔 수 없어요',
    poor: (n) => `돈이 ${money(n)} 모자라요`,
    sellAsk: (name, refund) => `'${name}'을(를) 팔고 ${money(refund)}원을 돌려받을까요?`,
    sellYes: '팔래요',
    sellNo: '아니요',
  },
  en: {
    panel: 'Building',
    level: (n, max) => `Level ${n} / ${max}`,
    now: 'Bonus now',
    next: 'After upgrade',
    none: 'No bonus',
    unlocks: 'Unlocks per level',
    schemes: 'Combos it joins',
    owner: 'Star',
    helper: 'Helper',
    times: (n) => `×${n}`,
    noScheme: 'No combos yet. Try building something right next to it!',
    hints: 'Try putting these together?',
    unknown: '???',
    beside: 'next to',
    upgrade: 'Upgrade',
    maxed: 'Max level!',
    move: 'Move',
    sell: 'Sell',
    noSell: "This building can't be sold",
    poor: (n) => `You need ${money(n)} more coins`,
    sellAsk: (name, refund) => `Sell the ${name} and get ${money(refund)} coins back?`,
    sellYes: 'Sell it',
    sellNo: 'No',
  },
});

const sellable = (def) => def && def.sellable !== false && !(def.tags ?? []).includes('왕') && def.key !== 'throne';

function defaultRefund(building, def) {
  const spent = (def?.price ?? []).slice(0, building?.level ?? 1).reduce((a, b) => a + (b || 0), 0);
  return Math.floor(spent * (VILLAIN.lair?.sellRefund ?? 0.5));
}

// 태그('물') 또는 'f:시설키' 에 이 시설이 맞는지
function fits(need, def) {
  const n = need ?? '';
  return n === '*' || (n.startsWith('f:') ? n.slice(2) === def.key : (def.tags ?? []).includes(n));
}

// 이 시설이 주인공(self)이거나 이웃(adjacent)으로 끼는 계책인지
const involves = (scheme, def) => fits(scheme?.self, def) || (scheme?.adjacent ?? []).some((a) => fits(a.need, def));

export function createFacilityPanel({ onUpgrade, onMove, onSell, onClose, refundOf } = {}) {
  const box = el(`
    <section class="lpanel facpanel" aria-label="${TEXT.panel}">
      <div data-head></div>
      <div class="lpanel-body" data-body tabindex="-1"></div>
      <footer class="facpanel-actions" data-actions></footer>
    </section>`);
  const head = box.querySelector('[data-head]');
  const body = box.querySelector('[data-body]');
  const actions = box.querySelector('[data-actions]');
  let state = {};
  let lastSig = '';

  function levelStars(level, max) {
    return `<span class="lvl-stars" aria-label="${TEXT.level(level, max)}">${Array.from({ length: max }, (_, i) => `<i class="${i < level ? 'on' : ''}">${lairIcon('star')}</i>`).join('')}</span>`;
  }

  function schemeRows(b, def) {
    const active = (state.evaluation?.schemes ?? []).filter((s) => (s.ownerIds ?? []).includes(b.id) || (s.links ?? []).some((l) => l.includes(b.id)));
    if (!active.length) return `<p class="facpanel-empty">${TEXT.noScheme}</p>`;
    return active
      .map((s) => {
        const sdef = schemeOf(s.key, state.schemes) ?? { name: s.key };
        const owner = (s.ownerIds ?? []).includes(b.id);
        return `
          <div class="srow is-on">
            <span class="srow-icon">${artOf(sdef)}</span>
            <span class="srow-text"><b>${escapeHTML(sdef.name)}</b><small>${owner ? TEXT.owner : TEXT.helper}${s.count > 1 ? ` · ${TEXT.times(s.count)}` : ''}</small></span>
            <span class="srow-fx">${effectChips(describeEffect(s.effect ?? sdef.effect, 1))}</span>
          </div>`;
      })
      .join('');
  }

  // 아직 안 켜진, 이 시설이 끼는 계책 힌트 (주인공인 것 먼저, 2개까지)
  function hintRows(b, def) {
    const on = new Set((state.evaluation?.schemes ?? []).map((s) => s.key));
    const seen = new Set(state.schemesSeen ?? []);
    const open = (state.schemes ?? []).filter((s) => !on.has(s.key) && !s.shape && involves(s, def));
    const list = [...open.filter((s) => fits(s.self, def)), ...open.filter((s) => !fits(s.self, def))].slice(0, 2);
    if (!list.length) return '';
    return `
      <h3 class="lpanel-sub">${lairIcon('spark')}${TEXT.hints}</h3>
      ${list
        .map((s) => {
          const known = seen.has(s.key);
          const needs = (s.adjacent ?? []).map((n) => needChips(n.need, state.facilities, { count: n.count ?? 1 })).join('');
          return `
            <div class="srow is-hint${known ? '' : ' is-unknown'}">
              <span class="srow-icon">${known ? artOf(s) : art('question')}</span>
              <span class="srow-text"><b>${known ? escapeHTML(s.name) : TEXT.unknown}</b><span class="srow-need">${needChips(s.self, state.facilities)}<i>${TEXT.beside}</i>${needs}</span></span>
            </div>`;
        })
        .join('')}`;
  }

  function render(next = {}) {
    state = { ...state, ...next };
    const b = state.building;
    const def = state.def;
    if (!b || !def) return;
    const sig = signature([b, def.key, state.money, state.evaluation?.schemes?.map((s) => [s.key, s.count, s.ownerIds, s.links]), (state.schemesSeen ?? []).length]);
    if (sig === lastSig) return;
    lastSig = sig;
    const max = def.levels ?? def.price?.length ?? 3;
    const level = Math.max(1, Math.min(max, b.level ?? 1));
    head.innerHTML = sheetHead({ icon: artOf(def), title: def.name });
    head.querySelector('.lsheet-title').insertAdjacentHTML('beforeend', levelStars(level, max));

    const nowFx = describeEffect(def.effect, level);
    const nextFx = level < max ? describeEffect(def.effect, level + 1) : null;
    const unlocks = unlockLines(def);
    body.innerHTML = `
      ${def.desc ? `<p class="facpanel-desc">${escapeHTML(def.desc)}</p>` : ''}
      <div class="facpanel-fx">
        <div class="fxbox"><small>${TEXT.now}</small><span>${effectChips(nowFx, { empty: TEXT.none })}</span></div>
        ${nextFx ? `<div class="fxbox is-next"><small>${lairIcon('up')}${TEXT.next}</small><span>${effectChips(nextFx, { empty: TEXT.none })}</span></div>` : ''}
      </div>
      ${unlocks.length ? `<h3 class="lpanel-sub">${TEXT.unlocks}</h3><ul class="unlock-list">${unlocks.map((u) => `<li class="${u.level <= level ? 'is-open' : ''}"><em>${u.level}</em><span class="unlock-text">${u.html}</span>${u.level <= level ? lairIcon('check') : ''}</li>`).join('')}</ul>` : ''}
      <h3 class="lpanel-sub">${lairIcon('link')}${TEXT.schemes}</h3>
      ${schemeRows(b, def)}
      ${hintRows(b, def)}`;

    const upPrice = level < max ? def.price?.[level] ?? 0 : null;
    const poor = upPrice != null && upPrice > (state.money ?? 0);
    const refund = refundOf ? refundOf(b, def) : defaultRefund(b, def);
    actions.innerHTML = `
      ${
        upPrice == null
          ? `<button type="button" class="vt-btn facpanel-up is-maxed" data-act="maxed" aria-disabled="true">${lairIcon('star')}<span>${TEXT.maxed}</span></button>`
          : `<button type="button" class="vt-btn vt-btn--gold facpanel-up" data-act="upgrade" ${poor ? 'aria-disabled="true"' : ''}>${lairIcon('up')}<span>${TEXT.upgrade}</span>${coin(upPrice)}</button>`
      }
      <button type="button" class="vt-btn facpanel-move" data-act="move">${lairIcon('move')}<span>${TEXT.move}</span></button>
      ${sellable(def) ? `<button type="button" class="vt-btn facpanel-sell" data-act="sell">${lairIcon('sell')}<span>${TEXT.sell}</span>${coin(refund, { sign: true })}</button>` : ''}`;
    box.dataset.level = String(level);
  }

  box.addEventListener('click', async (event) => {
    if (event.target.closest('[data-close]')) return onClose?.();
    const button = event.target.closest('[data-act]');
    const b = state.building;
    const def = state.def;
    if (!button || !b || !def) return;
    const act = button.dataset.act;
    if (act === 'upgrade') {
      const max = def.levels ?? def.price?.length ?? 3;
      const price = def.price?.[b.level ?? 1] ?? 0;
      if ((b.level ?? 1) >= max) return;
      if (price > (state.money ?? 0)) {
        bump(button, 'is-shake');
        toast(TEXT.poor(price - (state.money ?? 0)), { kind: 'bad' });
        return;
      }
      onUpgrade?.(b.id);
    } else if (act === 'maxed') {
      bump(button, 'is-shake');
    } else if (act === 'move') onMove?.(b.id);
    else if (act === 'sell') {
      const refund = refundOf ? refundOf(b, def) : defaultRefund(b, def);
      const host = box.closest('.vt-screen') ?? document.body;
      const yes = await askDialog(host, { message: TEXT.sellAsk(def.name, refund), yes: TEXT.sellYes, no: TEXT.sellNo, danger: true });
      if (yes) onSell?.(b.id);
    }
  });

  return { el: box, render, get body() { return body; } };
}
