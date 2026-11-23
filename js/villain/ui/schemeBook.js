// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 계책 도감
// 시설을 서로 붙이면 켜지는 '계책' 목록입니다. 한 번 켜 본 계책은 이름 · 설명 · 조건 · 효과를 다 보여 주고,
// 아직 못 찾은 계책은 ??? 로 가리고 어떤 시설이 필요한지 그림만 살짝 보여 줍니다 (찾는 재미).
// 맨 위에는 지금 소굴이 주는 효과 모음(출동 값 −18% 같은 것)이 있어요.
//
// 쓰는 법
//   const book = createSchemeBook({ onClose() })
//   book.el
//   book.render({ schemes, schemesSeen, evaluation, facilities, modsSummary })
//       schemes: [{ key, name, icon, tier, self, adjacent:[{ need, count }], shape?, effect, desc }]
//       modsSummary: modifiers.describeModifiers(mods) 결과 [{ label, value, good }]
//
// 글자는 아래 TEXT, 모양은 css/villain-lair2.css (.schemebook) 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { el, escapeHTML } from './uiKit.js';
import { art, lairIcon } from './lairArt.js';
import { describeEffect, effectChips, needChips, sheetHead, signature } from './lairKit.js';

const TEXT = {
  title: '계책 도감',
  found: (n, all) => `${n} / ${all} 찾았어요`,
  summary: '지금 소굴 효과',
  noSummary: '아직 효과가 없어요. 시설을 지어 보세요!',
  tiers: { 1: '쉬운 계책', 2: '솜씨 계책', 3: '전설 계책' },
  on: (n) => (n > 1 ? `켜짐 ×${n}` : '켜짐'),
  off: '꺼짐',
  unknown: '???',
  unknownDesc: '이 시설들을 붙여 보면 무언가 일어날지도…?',
  beside: '옆에',
  cross: '의 위·아래·왼쪽·오른쪽을 모두',
  crossTail: '(으)로',
  surround: '둘레를 시설로 꽉 채우기',
  effect: '효과',
};

export function createSchemeBook({ onClose } = {}) {
  const box = el(`
    <section class="lpanel schemebook" aria-label="${TEXT.title}">
      ${sheetHead({ icon: lairIcon('book'), title: TEXT.title, sub: ' ' })}
      <div class="lpanel-body" data-body tabindex="-1"></div>
    </section>`);
  const body = box.querySelector('[data-body]');
  const sub = box.querySelector('[data-sub]');
  let state = {};
  let lastSig = '';

  function ruleHTML(s, hidden) {
    const self = needChips(s.self, state.facilities, { hidden });
    if (s.shape === 'surround') return `${self}<i>${TEXT.surround}</i>`;
    const needs = (s.adjacent ?? []).map((n) => needChips(n.need, state.facilities, { hidden, count: n.count ?? 1 })).join('<i>+</i>');
    if (s.shape === 'cross') return `${self}<i>${hidden ? '+' : TEXT.cross}</i>${needs}${hidden ? '' : `<i>${TEXT.crossTail}</i>`}`;
    return `${self}<i>${hidden ? '+' : TEXT.beside}</i>${needs}`;
  }

  function entryHTML(s, index) {
    const seen = (state.schemesSeen ?? []).includes(s.key);
    const active = (state.evaluation?.schemes ?? []).find((x) => x.key === s.key);
    if (!seen && !active) {
      return `
        <article class="scard is-unknown" style="--i:${index}">
          <span class="scard-icon">${art('question')}</span>
          <div class="scard-main">
            <h3 class="scard-name">${TEXT.unknown}</h3>
            <p class="scard-rule">${ruleHTML(s, true)}</p>
            <p class="scard-desc">${TEXT.unknownDesc}</p>
          </div>
        </article>`;
    }
    return `
      <article class="scard${active ? ' is-on' : ''}" style="--i:${index}">
        <span class="scard-icon">${art(s.icon ?? 'book')}</span>
        <div class="scard-main">
          <h3 class="scard-name">${escapeHTML(s.name)}<span class="scard-state">${active ? TEXT.on(active.count ?? 1) : TEXT.off}</span></h3>
          <p class="scard-rule">${ruleHTML(s, false)}</p>
          <p class="scard-desc">${escapeHTML(s.desc ?? '')}</p>
          <p class="scard-fx"><small>${TEXT.effect}</small>${effectChips(describeEffect(s.effect, 1))}</p>
        </div>
      </article>`;
  }

  function render(next = {}) {
    state = { ...state, ...next };
    const schemes = state.schemes ?? [];
    const sig = signature([schemes.map((s) => s.key), state.schemesSeen, state.evaluation?.schemes?.map((s) => [s.key, s.count]), state.modsSummary, (state.facilities ?? []).length]);
    if (sig === lastSig) return;
    lastSig = sig;
    const seenCount = schemes.filter((s) => (state.schemesSeen ?? []).includes(s.key)).length;
    sub.textContent = TEXT.found(seenCount, schemes.length);
    const summary = state.modsSummary ?? [];
    const tiers = [...new Set(schemes.map((s) => s.tier ?? 1))].sort((a, b) => a - b);
    let index = 0;
    const scroll = body.scrollTop;
    body.innerHTML = `
      <div class="mods-summary">
        <small>${lairIcon('spark')}${TEXT.summary}</small>
        <span>${summary.length ? effectChips(summary.map((m) => ({ ...m, good: m.good !== false }))) : `<em>${TEXT.noSummary}</em>`}</span>
      </div>
      ${tiers
        .map(
          (t) => `
        <h3 class="lpanel-sub tier-title"><span class="tier-stars">${lairIcon('star').repeat(t)}</span>${TEXT.tiers[t] ?? `${t}단계 계책`}</h3>
        <div class="slist">${schemes
          .filter((s) => (s.tier ?? 1) === t)
          .map((s) => entryHTML(s, index++))
          .join('')}</div>`,
        )
        .join('')}`;
    body.scrollTop = scroll;
  }

  box.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) onClose?.();
  });

  return { el: box, render, get body() { return body; } };
}
