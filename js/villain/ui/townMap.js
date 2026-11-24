// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 마을 지도 (출동!) — 1) 마을 고르기 → 2) 괴수 고르기 → 출동
// 1) 마을 카드 3장: 마을 그림, 이름, 한 줄 소개, 지키는 영웅(얼굴 · 이름 · 힌트), 수입 배수, 이긴 횟수.
//    잠긴 마을은 흐리게 + 왜 잠겼는지("악명 2단계에 열려요").
// 2) 괴수 카드: 소굴 효과가 반영된 출동 값(원래 값은 줄 그어 보여 줌), 하나 골라 [출동!].
//
// 쓰는 법
//   const map = createTownMap({ onRaid(design, townId), onClose(), costOf(design), baseCostOf(design)?,
//                               blocksOf(design), hpOf(design)?, thumbOf(design)? })
//   map.el
//   map.open({ townId? })        열기 (townId 를 주면 바로 2단계)
//   map.render({ towns, designs, money, modsSummary, ranks, lastDesignId? })   (lastDesignId: 처음에 골라 둘 괴수)
//       towns: [{ id, name, blurb, hero, heroName?, heroHint, unlockRank, payMul, notorietyBase?, unlocked, wins }]
//   map.step                     'towns' | 'monsters'
//
// 글자는 아래 TEXT, 모양은 css/villain-lair2.css (.townmap, .tcard, .pick) 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { el, escapeHTML, money, coin, bump, toast, countTo } from './uiKit.js';
import { icon } from './uiIcons.js';
import { townArt, heroFace, lairIcon } from './lairArt.js';
import { effectChips, lockText, makeThumbs, partIcons, signature } from './lairKit.js';
import { L } from '../lang/lang.js';

const TEXT = L({
  ko: {
    title: '어느 마을을 습격할까요?',
    back: '소굴로',
    backTowns: '마을',
    pickTitle: () => '누구를 보낼까요?',
    hero: '지키는 영웅',
    pay: (m) => `수입 ×${Number(m ?? 1).toFixed(1)}`,
    noto: (n) => `악명 +${money(n)}`,
    wins: (n) => (n > 0 ? `${money(n)}번 이겼어요` : '아직 못 이겼어요'),
    go: '출동!',
    pickFirst: '보낼 괴수를 골라요',
    poor: (n) => `돈이 ${money(n)} 모자라요. 더 작은 괴수를 보내 보세요`,
    noMonster: '괴수가 없어요. 소굴에서 먼저 그려 와요',
    mods: '소굴 효과',
    myMoney: '가진 돈',
    noName: '이름 없는 괴수',
    hero0: '영웅',
    heroNames: { knight: '번개 기사', iceMage: '얼음 마법사', guardian: '황금 수호자' },
  },
  en: {
    title: 'Which town will you raid?',
    back: 'Lair',
    backTowns: 'Towns',
    pickTitle: () => 'Who will you send?',
    hero: 'Defended by',
    pay: (m) => `Coins ×${Number(m ?? 1).toFixed(1)}`,
    noto: (n) => `Infamy +${money(n)}`,
    wins: (n) => (n > 0 ? (n === 1 ? 'Won once' : `Won ${money(n)} times`) : 'Not won yet'),
    go: 'Attack!',
    pickFirst: 'Pick a monster to send',
    poor: (n) => `You need ${money(n)} more coins. Try a smaller monster`,
    noMonster: 'No monsters yet. Draw one in your lair first',
    mods: 'Lair bonuses',
    myMoney: 'Your coins',
    noName: 'Nameless monster',
    hero0: 'Hero',
    heroNames: { knight: 'Thunder Knight', iceMage: 'Ice Mage', guardian: 'Golden Guardian' },
  },
});

// 괴수 고르기 위에 보여 줄 소굴 효과 (습격에 바로 드러나는 것만)
const RAID_KEYS = ['cost', 'pay', 'hp', 'dmg', 'partDmg', 'smash', 'heroHp', 'heroDelay'];
const HERO_NAMES = TEXT.heroNames;
const heroNameOf = (t) => t.heroName ?? VILLAIN.heroes?.[t.hero]?.name ?? (t.hero === 'knight' ? VILLAIN.hero?.name : null) ?? HERO_NAMES[t.hero] ?? TEXT.hero0;
const heroHintOf = (t) => t.heroHint ?? VILLAIN.heroes?.[t.hero]?.hint ?? (t.hero === 'knight' ? VILLAIN.hero?.hint : '') ?? '';

export function createTownMap(options = {}) {
  const { onRaid, onClose } = options;
  const costOf = options.costOf ?? (() => 0);
  const baseCostOf = options.baseCostOf ?? null;
  const blocksOf = options.blocksOf ?? ((d) => (d.cells ?? []).join('').replace(/\./g, '').length);
  const hpOf = options.hpOf ?? ((d) => Math.round(blocksOf(d) * VILLAIN.monster.hpPerBlock));
  const thumb = makeThumbs(options.thumbOf);

  const box = el(`
    <section class="townmap" aria-label="${TEXT.title}" hidden>
      <header class="townmap-head">
        <button type="button" class="vt-btn townmap-back" data-act="back">${icon('back')}<span data-back>${TEXT.back}</span></button>
        <h2 class="townmap-title" data-title>${TEXT.title}</h2>
        <div class="vt-money" title="${TEXT.myMoney}">${icon('coin')}<b data-money>0</b></div>
      </header>
      <div class="townmap-towns" data-towns tabindex="-1"></div>
      <div class="townmap-pick" data-pick hidden>
        <div class="pick-town" data-picktown></div>
        <div class="pick-grid" data-grid tabindex="-1"></div>
        <footer class="pick-foot">
          <button type="button" class="vt-btn vt-btn--go vt-btn--big pick-go" data-act="go">${icon('play')}<span data-goname>${TEXT.go}</span><span class="pick-go-cost" data-gocost></span></button>
        </footer>
      </div>
    </section>`);
  const townsEl = box.querySelector('[data-towns]');
  const pickEl = box.querySelector('[data-pick]');
  const grid = box.querySelector('[data-grid]');
  const moneyEl = box.querySelector('[data-money]');
  let state = { towns: [], designs: [], money: 0, modsSummary: [], ranks: [] };
  let step = 'towns';
  let townId = null;
  let pickedId = null;
  let lastTownSig = '';
  let lastPickSig = '';

  const town = () => (state.towns ?? []).find((t) => t.id === townId) ?? null;

  function townCardHTML(t, index) {
    const locked = t.unlocked === false;
    return `
      <button type="button" class="tcard tcard--${escapeHTML(t.id)}${locked ? ' is-locked' : ''}" data-town="${escapeHTML(t.id)}" style="--i:${index}" ${locked ? 'aria-disabled="true"' : ''}>
        <span class="tcard-art">
          ${townArt(t.id)}
          ${t.wins > 0 ? `<span class="tcard-wins" title="${TEXT.wins(t.wins)}">${lairIcon('trophy')}${money(t.wins)}</span>` : ''}
          ${locked ? `<span class="tcard-lock">${icon('lock')}</span>` : ''}
        </span>
        <span class="tcard-body">
          <b class="tcard-name">${escapeHTML(t.name)}</b>
          ${t.blurb ? `<small class="tcard-blurb">${escapeHTML(t.blurb)}</small>` : ''}
          <span class="tcard-hero">
            <span class="tcard-face">${heroFace(t.hero)}</span>
            <span><small>${TEXT.hero}</small><b>${escapeHTML(heroNameOf(t))}</b><em>${escapeHTML(heroHintOf(t))}</em></span>
          </span>
          <span class="tcard-foot">
            ${
              locked
                ? `<span class="tcard-locktext">${icon('lock')}${escapeHTML(t.lockText ?? lockText(t.unlockRank ?? 0, state.ranks))}</span>`
                : `<span class="tchip is-pay">${icon('coin')}${TEXT.pay(t.payMul)}</span>${t.notorietyBase ? `<span class="tchip is-noto">${lairIcon('skull')}${TEXT.noto(t.notorietyBase)}</span>` : ''}<span class="tchip is-wins">${TEXT.wins(t.wins ?? 0)}</span>`
            }
          </span>
        </span>
      </button>`;
  }

  function pickCardHTML(design, index) {
    const cost = costOf(design);
    const base = baseCostOf ? baseCostOf(design) : cost;
    const poor = cost > state.money;
    return `
      <button type="button" class="pick${design.id === pickedId ? ' is-picked' : ''}${poor ? ' is-poor' : ''}" data-id="${escapeHTML(design.id)}" style="--i:${index}" aria-pressed="${design.id === pickedId}">
        <span class="pick-pic"><img src="${thumb(design)}" alt="" draggable="false"><span class="pick-check">${icon('check')}</span></span>
        <b class="pick-name">${escapeHTML(design.name || TEXT.noName)}</b>
        <span class="pick-stats"><span class="vt-chip">${icon('block')}${money(blocksOf(design))}</span><span class="vt-chip vt-chip--hp">${icon('heart')}${money(hpOf(design))}</span><span class="mcard-parts">${partIcons(design)}</span></span>
        <span class="pick-cost">${base !== cost ? `<s>${money(base)}</s>` : ''}${coin(cost)}</span>
      </button>`;
  }

  function renderTowns() {
    const sig = signature([state.towns, state.ranks?.length]);
    if (sig === lastTownSig) return;
    lastTownSig = sig;
    townsEl.innerHTML = (state.towns ?? []).map(townCardHTML).join('');
  }

  function renderPick() {
    const t = town();
    const designs = state.designs ?? [];
    if (pickedId && !designs.some((d) => d.id === pickedId)) pickedId = null;
    if (!pickedId) pickedId = (designs.find((d) => d.id === state.lastDesignId && costOf(d) <= state.money) ?? designs.find((d) => costOf(d) <= state.money) ?? designs[0])?.id ?? null;
    const sig = signature([townId, pickedId, state.money, state.modsSummary, designs.map((d) => [d.id, d.updatedAt, costOf(d)])]);
    if (sig === lastPickSig) return;
    lastPickSig = sig;
    if (t) {
      const mods = (state.modsSummary ?? []).filter((m) => (m.key ? RAID_KEYS.includes(m.key) : /출동|수입|체력|공격|부수|영웅/.test(m.label))).slice(0, 5);
      box.querySelector('[data-picktown]').innerHTML = `
        <span class="pick-town-art tcard--${escapeHTML(t.id)}">${townArt(t.id)}</span>
        <span class="pick-town-info"><b>${escapeHTML(t.name)}</b><span><span class="pick-town-face">${heroFace(t.hero)}</span>${escapeHTML(heroNameOf(t))} · ${TEXT.pay(t.payMul)}</span></span>
        ${mods.length ? `<span class="pick-mods"><small>${TEXT.mods}</small>${effectChips(mods.map((m) => ({ ...m, good: m.good !== false })))}</span>` : ''}`;
    }
    const scroll = grid.scrollTop;
    grid.innerHTML = designs.length ? designs.map(pickCardHTML).join('') : `<p class="pick-empty">${TEXT.noMonster}</p>`;
    grid.scrollTop = scroll;
    const design = designs.find((d) => d.id === pickedId);
    const go = box.querySelector('[data-act="go"]');
    box.querySelector('[data-goname]').textContent = TEXT.go;
    box.querySelector('[data-gocost]').innerHTML = design ? coin(costOf(design)) : '';
    go.setAttribute('aria-disabled', String(!design || costOf(design) > state.money));
  }

  function setStep(next) {
    step = next;
    const picking = step === 'monsters';
    townsEl.hidden = picking;
    pickEl.hidden = !picking;
    box.dataset.step = step;
    box.querySelector('[data-back]').textContent = picking ? TEXT.backTowns : TEXT.back;
    box.querySelector('[data-title]').textContent = picking ? TEXT.pickTitle(town()?.name ?? '') : TEXT.title;
    if (picking) renderPick();
    else renderTowns();
    bump(picking ? pickEl : townsEl, 'is-enter');
  }

  function render(next = {}) {
    state = { ...state, ...next };
    if (box.hidden) return; // 닫혀 있으면 내용만 기억 (열 때 그림)
    countTo(moneyEl, state.money, { from: moneyEl.dataset.value ? null : state.money });
    if (step === 'monsters') {
      if (!town() || town().unlocked === false) setStep('towns');
      else renderPick();
    } else renderTowns();
  }

  function open({ townId: id = null } = {}) {
    box.hidden = false;
    countTo(moneyEl, state.money, { from: state.money });
    lastPickSig = '';
    lastTownSig = '';
    const t = (state.towns ?? []).find((x) => x.id === id && x.unlocked !== false);
    townId = t?.id ?? null;
    setStep(t ? 'monsters' : 'towns');
  }

  box.addEventListener('click', (event) => {
    const act = event.target.closest('[data-act]')?.dataset.act;
    if (act === 'back') {
      if (step === 'monsters') return setStep('towns');
      return onClose?.();
    }
    if (act === 'go') {
      const design = (state.designs ?? []).find((d) => d.id === pickedId);
      const goBtn = event.target.closest('[data-act]');
      if (!design) {
        bump(goBtn, 'is-shake');
        return toast((state.designs ?? []).length ? TEXT.pickFirst : TEXT.noMonster, { kind: 'bad' });
      }
      const lack = costOf(design) - state.money;
      if (lack > 0) {
        bump(goBtn, 'is-shake');
        bump(moneyEl.parentElement, 'is-shake');
        return toast(TEXT.poor(lack), { kind: 'bad' });
      }
      return onRaid?.(design, townId);
    }
    const card = event.target.closest('.tcard');
    if (card) {
      const t = (state.towns ?? []).find((x) => x.id === card.dataset.town);
      if (!t) return;
      if (t.unlocked === false) {
        bump(card, 'is-shake');
        return toast(t.lockText ?? lockText(t.unlockRank ?? 0, state.ranks), { kind: 'bad' });
      }
      townId = t.id;
      lastPickSig = '';
      return setStep('monsters');
    }
    const pick = event.target.closest('.pick');
    if (pick) {
      pickedId = pick.dataset.id;
      renderPick();
      const fresh = grid.querySelector(`.pick[data-id="${CSS.escape(pickedId)}"]`);
      bump(fresh, 'is-bump');
      const design = (state.designs ?? []).find((d) => d.id === pickedId);
      if (design && costOf(design) > state.money) toast(TEXT.poor(costOf(design) - state.money), { kind: 'bad' });
    }
  });

  return {
    el: box,
    render,
    open,
    close() {
      box.hidden = true;
    },
    get step() {
      return step;
    },
    get townId() {
      return townId;
    },
  };
}
