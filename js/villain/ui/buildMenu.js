// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 짓기 메뉴 (시설 카드 목록) 와 자리 고르기 띠
// 짓기 메뉴: 시설마다 그림 · 이름 · 값 · 짧은 효과. 잠긴 시설은 왜 잠겼는지("악명 2단계에 열려요") 보여 줍니다.
// 자리 고르기 띠: 시설을 고르면 판이 접히고 얇은 띠만 남아요. 지금 자리에서 켜지는 계책(+초록) · 꺼지는 계책(−빨강),
//                 [짓기 ✓] [취소] 단추. 3D 소굴이 가려지지 않게 얇게 만듭니다.
//
// 쓰는 법
//   const menu = createBuildMenu({ onChoose(type), onClose() })
//   menu.el / menu.render({ facilities, money, rank, ranks })
//       facilities: [{ key, name, icon, size:[w,h], price:[..], unlockRank, maxCount, effect, desc, tags,
//                      unlocked, affordable, count }]   (unlocked · affordable 이 없으면 rank · money 로 계산)
//   const bar = createPlaceBar({ onConfirm(), onCancel() })
//   bar.el / bar.render({ placing, facilities, schemes, schemesSeen, money })
//       placing: { type, moveId?, preview: { valid, reason, gained:[key], lost:[key], delta:{ cost:-0.12 } } | null }
//
// 글자는 아래 TEXT, 모양은 css/villain-lair2.css (.fcard, .placebar) 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { el, escapeHTML, money, coin, bump, toast } from './uiKit.js';
import { artOf, lairIcon } from './lairArt.js';
import { describeEffect, effectChips, lockText, schemeOf, sheetHead, signature } from './lairKit.js';

const TEXT = {
  title: '무엇을 지을까요?',
  sub: '칸에 놓고, 옆에 붙여서 계책을 찾아요',
  locked: '악명이 오르면 열려요',
  empty: '아직 지을 수 있는 시설이 없어요',
  poor: (n) => `돈이 ${money(n)} 모자라요. 마을을 부숴서 벌어 와요`,
  max: (n) => (n > 1 ? `${n}개까지만 지을 수 있어요` : '하나만 지을 수 있어요'),
  maxShort: '다 지었어요',
  where: '어디에 지을까요?',
  whereMove: '어디로 옮길까요?',
  tapHint: '땅을 눌러 자리를 골라요',
  same: '이 자리에서는 계책이 그대로예요',
  fresh: '새 계책!',
  build: '짓기',
  move: '옮기기',
  cancel: '취소',
  free: '공짜',
};

const sizeText = (def) => `${def.size?.[0] ?? 1}×${def.size?.[1] ?? 1}`;

export function createBuildMenu({ onChoose, onClose } = {}) {
  const box = el(`
    <section class="lpanel buildmenu" aria-label="${TEXT.title}">
      ${sheetHead({ icon: lairIcon('hammer'), title: TEXT.title, sub: TEXT.sub })}
      <div class="lpanel-body" data-body tabindex="-1"></div>
    </section>`);
  const body = box.querySelector('[data-body]');
  let state = { facilities: [], money: 0, rank: null, ranks: [] };
  let lastSig = '';

  function info(def) {
    const rankNo = state.rank?.rank ?? 0;
    const unlocked = def.unlocked ?? rankNo >= (def.unlockRank ?? 0);
    const price = def.price?.[0] ?? 0;
    const affordable = def.affordable ?? state.money >= price;
    const atMax = def.maxCount != null && (def.count ?? 0) >= def.maxCount;
    return { unlocked, price, affordable, atMax };
  }

  function cardHTML(def, index) {
    const { unlocked, price, affordable, atMax } = info(def);
    const fx = describeEffect(def.effect, 1);
    const cls = !unlocked ? ' is-locked' : atMax ? ' is-max' : !affordable ? ' is-poor' : '';
    let foot;
    if (!unlocked) foot = `<span class="fcard-lock">${lairIcon('lock')}${escapeHTML(lockText(def.unlockRank ?? 0, state.ranks))}</span>`;
    else if (atMax) foot = `<span class="fcard-max">${lairIcon('check')}${TEXT.maxShort}</span>`;
    else foot = `<span class="fcard-price">${coin(price)}</span>`;
    // 이미 지은 개수 (최대 개수가 있으면 '1/2')
    const count = def.count > 0 && unlocked ? `<span class="fcard-count">${def.maxCount != null ? `${def.count}/${def.maxCount}` : `${def.count}개`}</span>` : '';
    return `
      <button type="button" class="fcard${cls}" data-key="${escapeHTML(def.key)}" style="--i:${index}" ${!unlocked || atMax || !affordable ? 'aria-disabled="true"' : ''}>
        <span class="fcard-pic">${artOf(def)}<span class="fcard-size">${sizeText(def)}</span>${count}</span>
        <b class="fcard-name">${escapeHTML(def.name)}</b>
        <span class="fcard-fx">${effectChips(fx.slice(0, 2))}</span>
        <small class="fcard-desc">${escapeHTML(def.desc ?? '')}</small>
        <span class="fcard-foot">${foot}</span>
      </button>`;
  }

  function render(next = {}) {
    state = { ...state, ...next };
    const list = state.facilities ?? [];
    const sig = signature([list.map((f) => [f.key, f.unlocked, f.affordable, f.count, f.price?.[0]]), state.money, state.rank?.rank]);
    if (sig === lastSig) return;
    lastSig = sig;
    const open = list.filter((f) => info(f).unlocked);
    const shut = list.filter((f) => !info(f).unlocked).sort((a, b) => (a.unlockRank ?? 0) - (b.unlockRank ?? 0));
    const scroll = body.scrollTop;
    body.innerHTML =
      (list.length ? `<div class="fgrid">${open.map(cardHTML).join('')}</div>` : `<p class="lpanel-empty">${TEXT.empty}</p>`) +
      (shut.length ? `<h3 class="lpanel-sub">${lairIcon('lock')}${TEXT.locked}</h3><div class="fgrid">${shut.map((f, i) => cardHTML(f, open.length + i)).join('')}</div>` : '');
    body.scrollTop = scroll;
  }

  box.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) return onClose?.();
    const card = event.target.closest('.fcard');
    if (!card) return;
    const def = (state.facilities ?? []).find((f) => f.key === card.dataset.key);
    if (!def) return;
    const { unlocked, price, atMax, affordable } = info(def);
    let why = '';
    if (!unlocked) why = lockText(def.unlockRank ?? 0, state.ranks);
    else if (atMax) why = TEXT.max(def.maxCount);
    else if (!affordable) why = TEXT.poor(Math.max(1, price - state.money));
    if (why) {
      bump(card, 'is-shake');
      toast(why, { kind: 'bad' });
      return;
    }
    onChoose?.(def.key);
  });

  return { el: box, render, get body() { return body; } };
}

// ── 자리 고르기 띠 ──
export function createPlaceBar({ onConfirm, onCancel } = {}) {
  const bar = el(`
    <section class="placebar" aria-live="polite" hidden>
      <div class="placebar-what" data-what></div>
      <div class="placebar-chips" data-chips></div>
      <div class="placebar-actions">
        <button type="button" class="vt-btn placebar-cancel" data-act="cancel">${lairIcon('close')}<span>${TEXT.cancel}</span></button>
        <button type="button" class="vt-btn vt-btn--go placebar-ok" data-act="ok">${lairIcon('check')}<span data-ok>${TEXT.build}</span></button>
      </div>
    </section>`);
  const what = bar.querySelector('[data-what]');
  const chips = bar.querySelector('[data-chips]');
  const ok = bar.querySelector('[data-act="ok"]');
  let state = { placing: null };
  let lastWhat = '';
  let lastChips = '';

  function schemeChip(key, sign) {
    const def = schemeOf(key, state.schemes) ?? { key, name: key };
    const fresh = sign === '+' && !(state.schemesSeen ?? []).includes(key);
    return `<span class="pchip ${sign === '+' ? 'is-gain' : 'is-lose'}${fresh ? ' is-fresh' : ''}"><i>${sign === '+' ? '+' : '−'}</i>${artOf(def)}<b>${escapeHTML(def.name)}</b>${fresh ? `<em>${lairIcon('spark')}${TEXT.fresh}</em>` : ''}</span>`;
  }

  function render(next = {}) {
    state = { ...state, ...next };
    const placing = state.placing;
    bar.hidden = !placing;
    if (!placing) {
      lastWhat = '';
      lastChips = '';
      return;
    }
    const moving = placing.moveId != null;
    const def = (state.facilities ?? []).find((f) => f.key === placing.type) ?? { key: placing.type, name: placing.type };
    const price = moving ? null : def.price?.[0] ?? 0;
    const whatHTML = `
      <span class="placebar-icon">${artOf(def)}</span>
      <span class="placebar-title"><b>${moving ? TEXT.whereMove : TEXT.where}</b><small>${escapeHTML(def.name)} ${price == null ? `· ${TEXT.free}` : coin(price)}</small></span>`;
    if (whatHTML !== lastWhat) {
      what.innerHTML = whatHTML;
      lastWhat = whatHTML;
    }
    const p = placing.preview;
    let chipHTML;
    if (!p) chipHTML = `<span class="pchip is-hint">${lairIcon('info')}${TEXT.tapHint}</span>`;
    else if (p.valid === false) chipHTML = `<span class="pchip is-nope">${lairIcon('stop')}<b>${escapeHTML(p.reason || '여기는 안 돼요')}</b></span>`;
    else {
      const gained = (p.gained ?? []).map((k) => schemeChip(k, '+')).join('');
      const lost = (p.lost ?? []).map((k) => schemeChip(k, '-')).join('');
      const delta = effectChips(describeEffect(p.delta ?? {}, 1), { className: 'is-delta' });
      chipHTML = gained || lost ? gained + lost + delta : `<span class="pchip is-same">${TEXT.same}</span>${delta}`;
    }
    if (chipHTML !== lastChips) {
      chips.innerHTML = chipHTML;
      lastChips = chipHTML;
      chips.scrollLeft = 0;
      if (p?.gained?.length) bump(chips, 'is-pop');
    }
    bar.querySelector('[data-ok]').textContent = moving ? TEXT.move : TEXT.build;
    const can = !!p && p.valid !== false;
    ok.setAttribute('aria-disabled', String(!can));
    bar.classList.toggle('is-invalid', !!p && p.valid === false);
    bar.classList.toggle('is-waiting', !p);
  }

  bar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    if (button.dataset.act === 'cancel') return onCancel?.();
    const p = state.placing?.preview;
    if (!p || p.valid === false) {
      bump(bar, 'is-shake');
      toast(p ? p.reason || '여기는 안 돼요' : TEXT.tapHint, { kind: 'bad' });
      return;
    }
    onConfirm?.();
  });

  return { el: bar, render };
}
