// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 부품 붙이기 (그림판 둘째 단계)
// 그린 괴수 그림 위에 공격 부품(집게발, 불 뿜는 입, 돌진 뿔)을 붙입니다.
//   · 부품 단추를 누르고 → 칠한 칸을 누르면 붙어요. 부품 단추를 그림 위로 끌어다 놓아도 돼요.
//   · 붙인 부품을 누르면 떼어져요. 끌면 다른 칸으로 옮겨져요. (그림 밖에 놓으면 떼어짐)
//   · 한 마리에 붙일 수 있는 개수는 villainConfig.js 의 parts.slots (소굴 효과로 늘면 setSlots(n))
//
// 쓰는 법
//   const placer = createPartPlacer(rootEl, { design, ownedParts })
//   placer.getParts()            [{ type, col, row }, ...]
//   placer.onChange(fn)          부품이 바뀔 때마다 fn(parts) → 그만 듣기 함수
//   placer.setDesign(design) / placer.setOwnedParts(list)    그림 · 가진 부품 바꿔 넣기
//   placer.setSlots(n)           붙일 수 있는 개수 바꾸기 (setDesign 전에 부르면 그 수까지 남김)
//   placer.extra                 옆 빈 자리 (미리보기 · 단추를 끼워 넣는 곳)
//   placer.refresh() / placer.destroy()
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { createPaintCanvas } from './paintCanvas.js';
import { icon } from './paintIcons.js';
import { EMPTY, fromCells } from './paintOps.js';
import { partIconURL } from './partIcons.js';
import { L } from '../lang/lang.js';

// 화면 글자
const TEXT = L({
  ko: {
    hint: '부품을 고르고 칠한 칸을 눌러요. 붙인 부품은 누르면 떼어져요.',
    slots: '붙인 부품',
    owned: '가진 부품',
    canvas: '부품을 붙일 괴수 그림',
    locked: '부품 상점에서 살 수 있어요',
    badge: (name) => `${name}: 누르면 떼어져요`,
    onlyPainted: '칠한 칸 위에만 붙일 수 있어요.',
    taken: '그 칸에는 이미 부품이 있어요.',
    full: (n) => `부품은 ${n}개까지 붙일 수 있어요. 붙인 부품을 눌러 떼어 보세요.`,
    part: '부품',
    placed: (name, josa) => `${name}${josa ? '을' : '를'} 붙였어요!`, // josa: 받침이 있는지
    removed: (name, josa) => `${name}${josa ? '을' : '를'} 뗐어요.`,
    pickFirst: '먼저 아래에서 부품을 골라 주세요.',
  },
  en: {
    hint: 'Pick a part, then tap a painted block. Tap a stuck part to take it off.',
    slots: 'Stuck on',
    owned: 'Your parts',
    canvas: 'Monster drawing to stick parts on',
    locked: 'Buy it in the Parts Shop',
    badge: (name) => `${name}: tap to take it off`,
    onlyPainted: 'Parts only stick on painted blocks.',
    taken: 'That block already has a part.',
    full: (n) => `You can stick on up to ${n} parts. Tap one to take it off.`,
    part: 'Part',
    placed: (name) => `${name} stuck on!`, // 영어는 받침(josa) 표시를 안 씀
    removed: (name) => `${name} taken off.`,
    pickFirst: 'Pick a part below first.',
  },
});
const DRAG_START = 8; // 이만큼(픽셀) 움직이면 '끌기'로 봄
const HINT_DEFAULT = TEXT.hint;

export function createPartPlacer(rootEl, { design, ownedParts = [] } = {}) {
  const types = VILLAIN.parts.types;
  let slots = VILLAIN.parts.slots;
  const hexByCh = new Map(VILLAIN.draw.palette.map((c) => [c.ch, c.hex]));
  const listeners = new Set();
  let cols = VILLAIN.draw.cols;
  let rows = VILLAIN.draw.rows;
  let grid = [];
  let parts = [];
  let owned = new Set(ownedParts);
  let selected = null;
  let drag = null;
  let hintTimer = 0;

  rootEl.classList.add('pp');
  rootEl.innerHTML = `
    <div class="pp-stage"></div>
    <div class="pp-side">
      <p class="pp-hint" aria-live="polite"></p>
      <div class="pp-slots" aria-label="${TEXT.slots}"></div>
      <div class="pp-chips" role="radiogroup" aria-label="${TEXT.owned}"></div>
      <div class="pp-extra"></div>
    </div>`;
  const stageEl = rootEl.querySelector('.pp-stage');
  const hintEl = rootEl.querySelector('.pp-hint');
  const slotsEl = rootEl.querySelector('.pp-slots');
  const chipsEl = rootEl.querySelector('.pp-chips');
  const paper = createPaintCanvas(stageEl, { cols, rows, colorOf: (ch) => hexByCh.get(ch) });
  const badgeLayer = document.createElement('div');
  badgeLayer.className = 'pp-badges';
  paper.frame.append(badgeLayer);
  paper.canvas.setAttribute('aria-label', TEXT.canvas);

  const painted = (col, row) => col >= 0 && row >= 0 && col < cols && row < rows && grid[row * cols + col] !== EMPTY;
  const partAt = (col, row) => parts.find((p) => p.col === col && p.row === row) ?? null;

  function say(text, warn) {
    hintEl.textContent = text;
    hintEl.classList.toggle('is-warn', Boolean(warn));
    clearTimeout(hintTimer);
    if (warn) {
      hintEl.classList.remove('is-shake');
      void hintEl.offsetWidth;
      hintEl.classList.add('is-shake');
      hintTimer = setTimeout(() => say(HINT_DEFAULT), 2600);
    }
  }

  function emit() {
    const copy = getParts();
    for (const fn of listeners) fn(copy);
  }

  function getParts() {
    return parts.map((p) => ({ type: p.type, col: p.col, row: p.row }));
  }

  // ── 그리기 ──────────────────────────────────────────────
  function renderChips() {
    chipsEl.innerHTML = '';
    for (const [type, info] of Object.entries(types)) {
      const has = owned.has(type);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'pp-chip';
      el.dataset.type = type;
      el.disabled = !has;
      el.classList.toggle('is-locked', !has);
      el.classList.toggle('is-on', has && type === selected);
      el.setAttribute('role', 'radio');
      el.setAttribute('aria-checked', String(has && type === selected));
      const note = has ? info.desc : TEXT.locked;
      const price = has ? `+${info.cost}` : `${info.price}`;
      el.innerHTML = `
        <img class="pp-chip-icon" alt="" draggable="false" src="${partIconURL(type)}">
        <span class="pp-chip-text"><b>${info.name}</b><small>${note}</small></span>
        <span class="pp-chip-cost">${icon('coin')}${price}</span>`;
      chipsEl.append(el);
    }
  }

  function renderSlots() {
    slotsEl.innerHTML = `<span class="pp-slots-label">${TEXT.slots}</span>`;
    for (let i = 0; i < slots; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'pp-slot';
      if (parts[i]) {
        dot.classList.add('is-full');
        dot.innerHTML = `<img alt="${types[parts[i].type]?.name ?? ''}" draggable="false" src="${partIconURL(parts[i].type)}">`;
      }
      slotsEl.append(dot);
    }
    const count = document.createElement('b');
    count.className = 'pp-slots-count';
    count.textContent = `${parts.length} / ${slots}`;
    slotsEl.append(count);
  }

  function renderBadges(popIndex = -1) {
    badgeLayer.innerHTML = '';
    parts.forEach((part, index) => {
      const box = paper.cellBox(part.col, part.row);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'pp-badge';
      el.dataset.index = String(index);
      el.title = TEXT.badge(types[part.type]?.name ?? part.type);
      el.setAttribute('aria-label', el.title);
      el.style.left = `${box.left + box.size / 2}px`;
      el.style.top = `${box.top + box.size / 2}px`;
      el.style.setProperty('--cell', `${box.size}px`);
      el.innerHTML = `<img alt="" draggable="false" src="${partIconURL(part.type)}">`;
      if (index === popIndex) el.classList.add('is-pop');
      badgeLayer.append(el);
    });
  }

  function renderAll(popIndex) {
    paper.draw(grid, { dimEmpty: true });
    renderBadges(popIndex);
    renderSlots();
    for (const el of chipsEl.children) {
      const on = !el.disabled && el.dataset.type === selected;
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-checked', String(on));
    }
  }

  // ── 붙이기 · 떼기 ───────────────────────────────────────
  function place(type, col, row, movingIndex = -1) {
    if (!painted(col, row)) {
      say(TEXT.onlyPainted, true);
      return false;
    }
    const there = partAt(col, row);
    if (movingIndex >= 0) {
      if (there && there !== parts[movingIndex]) {
        say(TEXT.taken, true);
        return false;
      }
      parts[movingIndex] = { type, col, row };
      renderAll(movingIndex);
    } else if (there) {
      there.type = type;
      renderAll(parts.indexOf(there));
    } else if (parts.length >= slots) {
      say(TEXT.full(slots), true);
      slotsEl.classList.remove('is-shake');
      void slotsEl.offsetWidth;
      slotsEl.classList.add('is-shake');
      return false;
    } else {
      parts.push({ type, col, row });
      renderAll(parts.length - 1);
    }
    say(TEXT.placed(types[type].name, hasFinalConsonant(types[type].name)));
    emit();
    return true;
  }

  function removeAt(index) {
    const [gone] = parts.splice(index, 1);
    if (!gone) return;
    renderAll();
    const name = types[gone.type]?.name ?? TEXT.part;
    say(TEXT.removed(name, hasFinalConsonant(name)));
    emit();
  }

  function hasFinalConsonant(word) {
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    return code >= 0 && code <= 11171 && code % 28 !== 0;
  }

  function select(type) {
    if (!owned.has(type)) return;
    selected = type;
    renderAll();
  }

  // ── 누르기 · 끌기 ───────────────────────────────────────
  function startDrag(event, info) {
    drag = { ...info, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moving: false, ghost: null, source: event.currentTarget };
    event.target.setPointerCapture?.(event.pointerId);
  }

  function onDragMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moving) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_START) return;
      drag.moving = true;
      drag.ghost = document.createElement('img');
      drag.ghost.className = 'pp-ghost';
      drag.ghost.alt = '';
      drag.ghost.src = partIconURL(drag.type);
      const size = Math.max(44, paper.cellSize * 2.4);
      drag.ghost.style.width = `${size}px`;
      drag.ghost.style.height = `${size}px`;
      document.body.append(drag.ghost);
      if (drag.index >= 0) badgeLayer.children[drag.index]?.classList.add('is-lifted');
    }
    event.preventDefault();
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
    const cell = paper.cellAt(event.clientX, event.clientY);
    paper.draw(grid, { dimEmpty: true, hover: cell.inside && painted(cell.x, cell.y) ? cell : null });
  }

  function onDragEnd(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const d = drag;
    drag = null;
    d.ghost?.remove();
    if (event.type === 'pointercancel') {
      renderAll();
      return;
    }
    if (!d.moving) {
      if (d.index >= 0) removeAt(d.index);
      else select(d.type);
      return;
    }
    const cell = paper.cellAt(event.clientX, event.clientY);
    if (d.index >= 0) {
      if (!cell.inside) removeAt(d.index);
      else if (!place(d.type, cell.x, cell.y, d.index)) renderAll();
    } else {
      select(d.type);
      if (cell.inside) place(d.type, cell.x, cell.y);
      else renderAll();
    }
  }

  chipsEl.addEventListener('pointerdown', (event) => {
    const chip = event.target.closest('.pp-chip');
    if (!chip || chip.disabled || drag) return;
    startDrag(event, { type: chip.dataset.type, index: -1 });
  });
  chipsEl.addEventListener('click', (event) => {
    // 키보드(Enter/Space)로 고를 때
    const chip = event.target.closest('.pp-chip');
    if (chip && !chip.disabled && event.detail === 0) select(chip.dataset.type);
  });
  badgeLayer.addEventListener('pointerdown', (event) => {
    const badge = event.target.closest('.pp-badge');
    if (!badge || drag) return;
    const index = Number(badge.dataset.index);
    startDrag(event, { type: parts[index].type, index });
  });
  badgeLayer.addEventListener('click', (event) => {
    const badge = event.target.closest('.pp-badge');
    if (badge && event.detail === 0) removeAt(Number(badge.dataset.index));
  });
  rootEl.addEventListener('pointermove', onDragMove);
  rootEl.addEventListener('pointerup', onDragEnd);
  rootEl.addEventListener('pointercancel', onDragEnd);
  // 끄는 동안 화면이 밀리거나, 끈 뒤 첫 누름이 먹히지 않는 일을 막습니다
  const onTouchMove = (event) => {
    if (drag) event.preventDefault();
  };
  rootEl.addEventListener('touchmove', onTouchMove, { passive: false });
  paper.canvas.addEventListener('click', (event) => {
    const cell = paper.cellAt(event.clientX, event.clientY);
    if (!cell.inside) return;
    if (!selected) {
      say(TEXT.pickFirst, true);
      return;
    }
    place(selected, cell.x, cell.y);
  });
  const stopLayout = paper.onLayout(() => renderBadges());

  function setDesign(next) {
    cols = next?.cols ?? cols;
    rows = next?.rows ?? rows;
    grid = fromCells(next?.cells ?? [], cols, rows);
    parts = [];
    for (const part of next?.parts ?? []) {
      if (parts.length < slots && types[part.type] && painted(part.col, part.row) && !partAt(part.col, part.row)) parts.push({ type: part.type, col: part.col, row: part.row });
    }
    paper.layout();
    renderAll();
  }

  function setOwnedParts(list) {
    owned = new Set(list ?? []);
    if (!owned.has(selected)) selected = Object.keys(types).find((t) => owned.has(t)) ?? null;
    renderChips();
    renderAll();
  }

  say(HINT_DEFAULT);
  setOwnedParts(ownedParts);
  setDesign(design);

  return {
    el: rootEl,
    extra: rootEl.querySelector('.pp-extra'),
    getParts,
    setDesign,
    setOwnedParts,
    setSlots(n) {
      const next = Math.max(1, Math.round(Number(n) || VILLAIN.parts.slots));
      if (next === slots) return;
      slots = next;
      if (parts.length > slots) parts = parts.slice(0, slots);
      renderAll();
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    refresh() {
      paper.layout();
      renderAll();
    },
    destroy() {
      clearTimeout(hintTimer);
      stopLayout();
      drag?.ghost?.remove();
      paper.destroy();
      listeners.clear();
      rootEl.classList.remove('pp');
      rootEl.innerHTML = '';
    },
  };
}
