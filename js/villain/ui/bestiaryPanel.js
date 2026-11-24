// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 괴수 도감 판
// 내가 그린 괴수와 기본 괴수 카드 목록입니다. 카드마다 그림 · 이름 · 블록 수 · 체력 · 빠르기 · 부품 · 출동 값,
// [고치기] [복사] [지우기] 단추. 출동은 여기서 하지 않고 [출동!] → 마을 지도에서 합니다.
// 지우기는 이 판이 먼저 "정말요?" 를 물어봐요.
// 맨 앞 '새 괴수' 카드: [그림판으로 그리기] [3D로 쌓기 (고수)]. 3D 는 악명 단계(villainConfig 의 sculpt.unlockRank)가 되면 열려요.
// 3D 블록 괴수 카드에는 '3D' 딱지가 붙고, [고치기] 를 누르면 3D 작업대가 열려요 (onOpenEditor 가 design.kind 를 보고 고름).
//
// 쓰는 법
//   const book = createBestiaryPanel({
//     onOpenEditor(design | null),  고치기 / 새 괴수 그리기 ({ kind: 'voxel' } 이면 새 3D 괴수)
//     onCopy(design), onRemove(design), onClose(),
//     costOf(design), baseCostOf(design)?, blocksOf(design), hpOf(design)?, speedOf(design)?, thumbOf(design)?,
//   })
//   book.el / book.render({ designs, money })
//
// 글자는 아래 TEXT, 카드 모양은 css/villain-lair.css (.mcard), 판 모양은 css/villain-lair2.css (.bestiary),
// 새 괴수 카드의 두 단추 · 3D 딱지는 css/villain-sculpt2.css 맨 아래.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { el, escapeHTML, money, coin, askDialog } from './uiKit.js';
import { icon } from './uiIcons.js';
import { lairIcon } from './lairArt.js';
import { sheetHead, makeThumbs, partIcons, signature } from './lairKit.js';
import { RANKS, rankFor } from '../data/ranks.js';
import { getSave } from '../data/saveStore.js';
import { designSpeed, isVoxel } from '../data/bestiary.js';

const TEXT = {
  title: '괴수 도감',
  count: (n) => `${n}마리`,
  newMonster: '새 괴수 만들기',
  newHint: '도트 그림판에서 직접 그려요',
  draw: '그림판으로 그리기',
  sculpt: '3D로 쌓기 (고수)',
  sculptLock: (rank, name) => `악명 ${rank}단계 '${name}'에 열려요`,
  badge3d: '3D',
  speed: '빠르기',
  noName: '이름 없는 괴수',
  blocks: '블록 수',
  hp: '체력',
  empty: '아직 괴수가 없어요. 한 마리 그려 볼까요?',
  edit: '고치기',
  copy: '복사',
  remove: '지우기',
  builtIn: '기본',
  cost: '출동 값',
  removeAsk: (name) => `'${name}' 괴수를 지울까요?`,
  removeYes: '지울래요',
  removeNo: '아니요',
};

export function createBestiaryPanel(options = {}) {
  const { onOpenEditor, onCopy, onRemove, onClose } = options;
  const costOf = options.costOf ?? (() => 0);
  const baseCostOf = options.baseCostOf ?? null;
  const blocksOf = options.blocksOf ?? ((d) => (d.cells ?? []).join('').replace(/\./g, '').length);
  const hpOf = options.hpOf ?? ((d) => Math.round(blocksOf(d) * VILLAIN.monster.hpPerBlock));
  const speedOf = options.speedOf ?? designSpeed;
  const unlockRank = VILLAIN.sculpt?.unlockRank ?? 0;
  const sculptOpen = () => rankFor(getSave().notoriety).rank >= unlockRank;
  const thumb = makeThumbs(options.thumbOf);

  const box = el(`
    <section class="lpanel bestiary" aria-label="${TEXT.title}">
      ${sheetHead({ icon: lairIcon('monster'), title: TEXT.title, sub: ' ' })}
      <div class="lpanel-body" data-body tabindex="-1"></div>
    </section>`);
  const body = box.querySelector('[data-body]');
  const sub = box.querySelector('[data-sub]');
  let state = { designs: [], money: 0 };
  let lastSig = '';

  function cardHTML(design, index) {
    const cost = costOf(design);
    const base = baseCostOf ? baseCostOf(design) : cost;
    return `
      <article class="mcard mcard--book" data-id="${escapeHTML(design.id)}" style="--i:${index}">
        <div class="mcard-pic">
          ${design.builtIn ? `<span class="vt-tag mcard-tag">${TEXT.builtIn}</span>` : ''}
          ${isVoxel(design) ? `<span class="vt-tag mcard-tag mcard-tag--3d">${TEXT.badge3d}</span>` : ''}
          <img class="mcard-img" src="${thumb(design)}" alt="" draggable="false">
        </div>
        <h3 class="mcard-name">${escapeHTML(design.name || TEXT.noName)}</h3>
        <p class="mcard-stats">
          <span class="vt-chip" title="${TEXT.blocks}">${icon('block')}${money(blocksOf(design))}</span>
          <span class="vt-chip vt-chip--hp" title="${TEXT.hp}">${icon('heart')}${money(hpOf(design))}</span>
          <span class="vt-chip mcard-speed" title="${TEXT.speed}">${icon('speed')}${speedOf(design).toFixed(1)}</span>
          <span class="mcard-parts">${partIcons(design)}</span>
        </p>
        <p class="mcard-cost"><small>${TEXT.cost}</small>${base !== cost ? `<s>${money(base)}</s>` : ''}${coin(cost)}</p>
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
    const open3d = sculptOpen();
    const sig = signature([designs.map((d) => [d.id, d.updatedAt, d.name, (d.parts ?? []).length, costOf(d)]), state.money, open3d]);
    if (sig === lastSig) return;
    lastSig = sig;
    sub.textContent = designs.length ? TEXT.count(designs.length) : '';
    const scroll = body.scrollTop;
    body.innerHTML = `
      <div class="lair-grid">
        <div class="mcard mcard--new mcard--make" style="--i:0">
          ${icon('plus')}<b>${TEXT.newMonster}</b><small>${designs.length ? TEXT.newHint : TEXT.empty}</small>
          <button type="button" class="vt-btn vt-btn--mini mcard-make" data-act="new">${icon('pencil')}<span>${TEXT.draw}</span></button>
          <button type="button" class="vt-btn vt-btn--mini mcard-make mcard-make--3d${open3d ? '' : ' is-locked'}" data-act="new3d" ${open3d ? '' : 'aria-disabled="true"'}>${icon(open3d ? 'block' : 'lock')}<span>${TEXT.sculpt}</span></button>
          ${open3d ? '' : `<small class="mcard-lock">${TEXT.sculptLock(unlockRank, RANKS[unlockRank]?.name ?? '')}</small>`}
        </div>
        ${designs.map((d, i) => cardHTML(d, i + 1)).join('')}
      </div>`;
    body.scrollTop = scroll;
  }

  box.addEventListener('click', async (event) => {
    if (event.target.closest('[data-close]')) return onClose?.();
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const act = button.dataset.act;
    if (act === 'new') return onOpenEditor?.(null);
    if (act === 'new3d') {
      if (sculptOpen()) return onOpenEditor?.({ kind: 'voxel' });
      button.classList.remove('is-shake');
      void button.offsetWidth;
      button.classList.add('is-shake');
      return;
    }
    const card = button.closest('.mcard');
    const design = (state.designs ?? []).find((d) => String(d.id) === card?.dataset.id);
    if (!design) return;
    if (act === 'edit') onOpenEditor?.(design);
    else if (act === 'copy') onCopy?.(design);
    else if (act === 'remove') {
      const host = box.closest('.vt-screen') ?? document.body;
      const yes = await askDialog(host, { message: TEXT.removeAsk(design.name), yes: TEXT.removeYes, no: TEXT.removeNo, danger: true });
      if (yes) onRemove?.(design);
    }
  });

  return { el: box, render, get body() { return body; } };
}
