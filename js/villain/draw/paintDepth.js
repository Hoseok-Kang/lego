// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 그림판: 두께 붓 (고르는 판 + 도화지 위 숫자 표시)
// 두께 붓을 고르면 색 물감 자리에 이 판이 나옵니다: 자동 · 1 ~ 7 중에 고르고 칠한 칸을 문지르면 그 두께가 돼요.
// 두께 붓을 든 동안 도화지 칸마다 두께 숫자가 보입니다 (진한 숫자 = 정한 두께, 흐린 숫자 = 자동 두께).
// 두꺼운 칸일수록 조금 어둡게 칠해서 한눈에 보여요.
//
// 쓰는 법
//   const panel = createDepthPanel(parentEl, { onPick(value), onAll(value) })   value: '.' (자동) 또는 '1'~'7'
//   panel.show(value) / panel.setVisible(bool) / panel.el
//   drawDepthOverlay(ctx, { cols, rows, size, grid, depths, autos })   autos: 칸마다 자동 두께 (autoDepths 결과)
//   autoDepths(grid, cols, rows) → 칸마다 자동 두께 숫자 (빈 칸은 0)
//   DEPTH_CHOICES   고를 수 있는 값 목록
//
// 글자는 아래 TEXT, 가장 두꺼운 두께는 villainConfig.js 의 draw.maxThickness, 모양은 css/villain-draw-board.css (.pb-depth).
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { readCells } from '../monster/monsterDepth.js';
import { EMPTY, toCells } from './paintOps.js';

const TEXT = {
  title: '두께 붓',
  hint: '칠한 칸을 문질러요',
  auto: '자동',
  autoHint: '통통하게 저절로 (가장자리 얇게, 속은 두껍게)',
  pickHint: (n) => `${n}칸 두께`,
  allAuto: '모두 자동',
  allFlat: '납작하게 (1)',
  legend: '진한 숫자 = 정한 두께 · 흐린 숫자 = 자동',
};

const SHADE = 0.065; // 두께 1칸마다 어두워지는 정도

export const DEPTH_CHOICES = ['.', ...Array.from({ length: Math.max(1, Math.min(9, VILLAIN.draw.maxThickness ?? 7)) }, (_, i) => String(i + 1))];

export function createDepthPanel(parentEl, { onPick, onAll }) {
  const el = document.createElement('div');
  el.className = 'pb-depth';
  el.hidden = true;
  el.innerHTML = `
    <p class="pb-depth-title"><b>${TEXT.title}</b><small>${TEXT.hint}</small></p>
    <div class="pb-depth-picks" role="radiogroup" aria-label="${TEXT.title}">
      ${DEPTH_CHOICES.map((v) => (v === EMPTY
        ? `<button type="button" class="pb-depth-pick pb-depth-pick--auto" data-depth="." role="radio" title="${TEXT.autoHint}"><b>${TEXT.auto}</b></button>`
        : `<button type="button" class="pb-depth-pick" data-depth="${v}" role="radio" title="${TEXT.pickHint(v)}" style="--n:${v}"><i aria-hidden="true"></i><b>${v}</b></button>`)).join('')}
    </div>
    <div class="pb-depth-quick">
      <button type="button" class="pb-btn pb-depth-all" data-all=".">${TEXT.allAuto}</button>
      <button type="button" class="pb-btn pb-depth-all" data-all="1">${TEXT.allFlat}</button>
    </div>
    <p class="pb-depth-legend">${TEXT.legend}</p>`;
  parentEl.append(el);
  el.addEventListener('click', (event) => {
    const pick = event.target.closest('[data-depth]');
    if (pick) return onPick?.(pick.dataset.depth);
    const all = event.target.closest('[data-all]');
    if (all) onAll?.(all.dataset.all);
  });
  return {
    el,
    show(value) {
      for (const button of el.querySelectorAll('[data-depth]')) {
        const on = button.dataset.depth === value;
        button.classList.toggle('is-on', on);
        button.setAttribute('aria-checked', String(on));
      }
    },
    setVisible(on) {
      el.hidden = !on;
    },
  };
}

export function autoDepths(grid, cols, rows) {
  const out = new Array(cols * rows).fill(0);
  for (const cell of readCells({ cols, rows, cells: toCells(grid, cols, rows) })) out[cell.row * cols + cell.col] = cell.auto;
  return out;
}

export function drawDepthOverlay(ctx, { cols, rows, size, grid, depths, autos }) {
  const max = Number(DEPTH_CHOICES[DEPTH_CHOICES.length - 1]) || 7;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const i = y * cols + x;
      if (grid[i] === EMPTY) continue;
      const set = depths[i] !== EMPTY;
      const value = set ? Math.min(max, Number(depths[i])) : autos[i] || 1;
      const px = x * size;
      const py = y * size;
      ctx.fillStyle = `rgba(16,8,36,${0.04 + SHADE * (value - 1)})`;
      ctx.fillRect(px, py, size, size);
      ctx.font = `${set ? 700 : 500} ${Math.max(7, Math.round(size * (set ? 0.66 : 0.48)))}px "Jua", system-ui, sans-serif`;
      ctx.lineWidth = Math.max(1.5, size * 0.12);
      ctx.strokeStyle = set ? 'rgba(20,10,40,0.9)' : 'rgba(20,10,40,0.45)';
      ctx.fillStyle = set ? '#ffffff' : 'rgba(255,255,255,0.72)';
      const cx = px + size / 2;
      const cy = py + size / 2 + size * 0.04;
      ctx.strokeText(String(value), cx, cy);
      ctx.fillText(String(value), cx, cy);
    }
  }
  ctx.restore();
}
