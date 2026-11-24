// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 3D 블록 작업대 화면 (고수용, 악명 단계로 열림 · 가로 화면 전용)
// 블록을 하나하나 쌓아 3D 괴수를 만듭니다. 차례: ① 쌓기 → ② 부품 붙이기 → ③ 이름 · 저장
//   ① 쌓기: [도구 기둥 | 색 | 3D 화면 (+ 숫자 · 다음) | 한 장씩 판]   블록 수 · 출동 값은 위쪽 줄에 늘 보임
//   ② 부품 붙이기: 앞에서 본 모습 위에 그림판과 같은 부품 붙이기 (draw/partPlacer.js)
//   ③ 이름 · 저장: 돌아가는 괴수 + 이름 + 출동 값 · 체력 · 빠르기 → 도감에 저장 (bestiary.saveDesign)
//
// 쓰는 법
//   const sculpt = createSculptScreen({ bestiary, saveStore, root, onDone, preview3d, partSlots?, statsOf? })
//     onDone(design | null) 저장하면 저장된 괴수, 그냥 나가면 null ; statsOf(design) → { cost, hp, speed } (소굴 효과 넣은 숫자)
//   sculpt.open(source)   source: 3D 괴수 (고치기) · 그림판 괴수 (그림에서 시작) · null 또는 { kind: 'voxel' } (시작 고르기 창)
//   sculpt.close() / sculpt.isOpen / sculpt.el / sculpt.grid / sculpt.getDesign()
//
// 숫자(공간 크기 · 최소/최대 블록)는 villainConfig.js 의 sculpt, 글자는 아래 TEXT, 모양은 css/villain-sculpt.css.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { askConfirm } from '../draw/confirmBox.js';
import { icon } from '../draw/paintIcons.js';
import { attachPaintKeys } from '../draw/paintKeys.js';
import { createPartPlacer } from '../draw/partPlacer.js';
import { designThumbURL } from '../draw/pixelThumb.js';
import { frontCells } from '../data/voxelDesign.js';
import { createSculptEdit } from './sculptEdit.js';
import { createSculptGrid } from './sculptGrid.js';
import { voxelsFromDrawing } from './sculptConvert.js';
import { createSculptRail } from './sculptRail.js';
import { createSculptSlice } from './sculptSlice.js';
import { createSculptStart } from './sculptStart.js';
import { createSculptView } from './sculptView.js';
import { sculptMarkup, TEXT } from './sculptText.js';

const SAVED_DELAY = 650;
const KEY_TOOL = { pencil: 'add', eraser: 'erase', fill: 'paint', picker: 'pick' }; // 그림판 단축키 → 작업대 도구

export function createSculptScreen({ bestiary, saveStore, root, onDone, preview3d, partSlots = null, statsOf = null } = {}) {
  const cfg = VILLAIN.sculpt;
  const { cols, rows, palette } = VILLAIN.draw;
  const hexOf = new Map(palette.map((c) => [c.ch, c.hex]));
  const colorOf = (ch) => hexOf.get(ch) ?? '#a0a5a9';
  const el = document.createElement('section');
  el.className = 'vd-editor vs-screen';
  el.hidden = true;
  el.setAttribute('aria-label', TEXT.title);
  el.innerHTML = sculptMarkup(cfg.maxBlocks);
  (root ?? document.body).append(el);
  const $ = (selector) => el.querySelector(selector);

  const grid = createSculptGrid({ w: cols, h: rows, d: cfg.size.d, palette, maxBlocks: cfg.maxBlocks });
  const edit = createSculptEdit({
    grid,
    colorOf,
    onPick: (ch) => setColor(ch),
    onFull: () => toast(TEXT.full(cfg.maxBlocks)),
    onDone: (kind, cell, tool) => {
      if (tool === 'pick') setTool('add');
      if (kind === 'view' && tool === 'add' && cell) slice.setLayer(cell.z); // 3D 에서 쌓으면 판도 그 장으로
    },
  });
  const rail = createSculptRail($('.vs-tools'), $('.vs-palette'), {
    palette,
    onTool: setTool,
    onColor: (ch) => {
      setColor(ch);
      if (edit.tool === 'erase' || edit.tool === 'pick') setTool('add');
    },
    onMirror: () => setMirror(!edit.mirror),
    onAction: (id) => (id === 'undo' ? grid.undo() : id === 'redo' ? grid.redo() : confirmClear()),
  });
  const view = createSculptView($('.vs-view-host'), { grid, colorOf, hooks: edit.hooks });
  const slice = createSculptSlice($('.vs-slice-host'), { grid, colorOf, hooks: edit.hooks, onLayer: (z) => view.setLayer(z) });
  const placer = createPartPlacer($('.vs-parts'), { design: { cols, rows, cells: [], parts: [] }, ownedParts: [] });
  const start = createSculptStart(el, {
    drawings: () => bestiary.list().filter((d) => !bestiary.isVoxel?.(d) && bestiary.countBlocks(d) > 0),
    examples: () => bestiary.list().filter((d) => d.builtIn && bestiary.isVoxel?.(d)),
    thumbOf: (d) => designThumbURL(d, 96, { parts: false }),
    onPick: begin,
    onCancel: () => (close(), onDone?.(null)),
  });
  const dock = $('.vd-dock');
  const previewBox = $('.vd-preview');
  let preview = null;
  let source = null; // 고치는 괴수 (id · builtIn 기억)
  let parts = [];
  let step = 'build';
  let dirty = false;
  let busy = false;
  let toastTimer = 0;
  let doneTimer = 0;

  // ── 지금 괴수 · 숫자 ────────────────────────────────────
  function currentDesign() {
    const voxels = grid.toVoxels();
    const cells = frontCells(voxels);
    return {
      id: source?.id ?? null,
      name: $('.vs-name input').value.trim() || source?.name || TEXT.namePlaceholder,
      cols,
      rows,
      kind: 'voxel',
      voxels,
      cells,
      parts: parts.filter((p) => cells[p.row]?.[p.col] && cells[p.row][p.col] !== '.').map((p) => ({ ...p })),
      builtIn: source?.builtIn || undefined,
      updatedAt: source?.updatedAt ?? 0,
    };
  }

  function refresh() {
    const now = currentDesign();
    const own = statsOf?.(now);
    const cost = own?.cost ?? bestiary.designCost(now);
    const hp = Math.round(own?.hp ?? bestiary.designHp(now));
    const speed = (own?.speed ?? bestiary.designSpeed(now)).toFixed(1);
    const money = saveStore.getSave().money;
    const check = bestiary.validate(now);
    for (const node of el.querySelectorAll('.vs-blocks')) node.textContent = String(grid.count);
    for (const node of el.querySelectorAll('.vd-cost, .vs-cost')) node.textContent = String(cost);
    for (const node of el.querySelectorAll('.vd-hp, .vs-hp')) node.textContent = String(hp);
    for (const node of el.querySelectorAll('.vd-speed, .vs-speed')) node.textContent = speed;
    $('.vd-money').textContent = String(money);
    $('.vs-count').classList.toggle('is-low', grid.count < cfg.minBlocks);
    $('.vs-count').classList.toggle('is-full', grid.full);
    el.classList.toggle('is-over', check.ok && cost > money);
    for (const btn of el.querySelectorAll('.vs-next, .vd-next')) btn.classList.toggle('is-waiting', !check.ok);
    const note = !check.ok ? check.message : cost > money ? TEXT.poor(cost - money) : TEXT.good[step];
    for (const node of el.querySelectorAll('.vd-note, .vs-note')) node.textContent = note;
    rail.showHistory(grid.canUndo, grid.canRedo);
  }

  function toast(text) {
    const box = $('.vd-toast');
    box.textContent = text;
    box.hidden = false;
    box.classList.remove('is-in');
    void box.offsetWidth;
    box.classList.add('is-in');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (box.hidden = true), 2200);
  }

  // ── 도구 ────────────────────────────────────────────────
  function setTool(name) {
    edit.setTool(name);
    rail.showTool(edit.tool);
    el.dataset.tool = edit.tool;
  }
  function setColor(ch) {
    if (!hexOf.has(ch)) return;
    edit.setColor(ch);
    rail.showColor(ch);
  }
  function setMirror(on) {
    edit.setMirror(on);
    rail.showMirror(edit.mirror);
    view.setMirror(edit.mirror);
    slice.setMirror(edit.mirror);
  }
  async function confirmClear() {
    if (!grid.count) return;
    const yes = await askConfirm(el, { message: TEXT.clearAsk, yes: TEXT.clearYes, no: TEXT.no, danger: true });
    if (yes) grid.clear();
  }
  const detachKeys = attachPaintKeys(el, {
    undo: () => step === 'build' && grid.undo(),
    redo: () => step === 'build' && grid.redo(),
    tool: (name) => KEY_TOOL[name] && step === 'build' && setTool(KEY_TOOL[name]),
    colorIndex: (index) => palette[index] && setColor(palette[index].ch),
  });

  // ── 차례 ────────────────────────────────────────────────
  function setStep(next) {
    step = next;
    el.dataset.step = next;
    const order = ['build', 'parts', 'save'];
    for (const chip of el.querySelectorAll('.vd-step')) {
      const index = order.indexOf(chip.dataset.step);
      chip.classList.toggle('is-on', chip.dataset.step === next);
      chip.classList.toggle('is-done', index < order.indexOf(next));
    }
    $('.vs-build').hidden = next !== 'build';
    $('.vs-parts').hidden = next !== 'parts';
    $('.vs-save').hidden = next !== 'save';
    $('.vd-next-text').textContent = next === 'parts' ? TEXT.nextParts : TEXT.save;
    $('.vd-prev span').textContent = next === 'parts' ? TEXT.prevBuild : TEXT.prevParts;
    if (next === 'build') {
      view.show();
      slice.refresh();
    } else view.hide();
    if (next === 'parts') {
      placer.extra.append(dock);
      dock.prepend(previewBox);
      placer.setOwnedParts(saveStore.getSave().ownedParts);
      if (partSlots) placer.setSlots(partSlots());
      placer.setDesign(currentDesign());
      parts = placer.getParts();
    }
    if (next === 'save') {
      $('.vs-save-look').append(previewBox);
      $('.vs-save-card').append(dock);
    }
    if (next !== 'build') showPreview();
    refresh();
  }
  function showPreview() {
    if (!preview && typeof preview3d === 'function') preview = preview3d($('.vd-preview-view'));
    preview?.show(currentDesign());
  }
  function goNext() {
    if (busy) return;
    const check = bestiary.validate(currentDesign());
    if (!check.ok) {
      toast(check.message);
      if (step !== 'build') setStep('build');
      return;
    }
    if (step === 'build') setStep('parts');
    else if (step === 'parts') setStep('save');
    else saveNow();
  }
  function goPrev() {
    if (!busy) setStep(step === 'save' ? 'parts' : 'build');
  }
  function saveNow() {
    busy = true;
    const saved = bestiary.saveDesign(currentDesign());
    source = saved;
    dirty = false;
    $('.vd-next-text').textContent = TEXT.saved;
    el.classList.add('is-saved');
    toast(TEXT.savedToast(saved.name));
    doneTimer = setTimeout(() => {
      busy = false;
      close();
      onDone?.(saved);
    }, SAVED_DELAY);
  }
  async function leave() {
    if (busy) return;
    if (dirty) {
      const yes = await askConfirm(el, { message: TEXT.leaveAsk, yes: TEXT.leaveYes, no: TEXT.leaveNo, danger: true });
      if (!yes) return;
    }
    close();
    onDone?.(null);
  }

  // ── 시작 ────────────────────────────────────────────────
  function begin({ kind, design }) {
    start.hide();
    if (kind === 'blank') load(null, null);
    else if (kind === 'drawing') load({ ...design, id: null, builtIn: undefined }, voxelsFromDrawing(design, grid));
    else load(design, design.voxels);
    dirty = kind === 'drawing';
  }
  function load(design, voxels) {
    source = design ? { id: design.id ?? null, name: design.name, builtIn: design.builtIn, updatedAt: design.updatedAt } : null;
    parts = (design?.parts ?? []).map((p) => ({ ...p }));
    $('.vs-name input').value = design?.name ?? '';
    grid.load(voxels ?? { layers: [] });
    view.resetCamera();
    slice.setLayer(Math.floor((grid.d - 1) / 2));
    if (design?.builtIn) toast(TEXT.builtInCopy);
    refresh();
  }

  grid.onChange(() => {
    dirty = true;
    refresh();
  });
  placer.onChange((next) => {
    parts = next;
    dirty = true;
    refresh();
    showPreview();
  });
  $('.vs-name input').addEventListener('input', () => (dirty = true));
  $('.vs-name input').addEventListener('keydown', (event) => event.key === 'Enter' && event.target.blur());
  $('.vd-back').addEventListener('click', leave);
  for (const btn of el.querySelectorAll('.vs-next, .vd-next')) btn.addEventListener('click', goNext);
  $('.vd-prev').addEventListener('click', goPrev);
  $('.vd-steps').addEventListener('click', (event) => {
    const target = event.target.closest('button.vd-step')?.dataset.step;
    if (!target || busy || target === step) return;
    if (target === 'build') setStep('build');
    else if (bestiary.validate(currentDesign()).ok && (target === 'parts' || step === 'parts')) setStep(target);
    else goNext();
  });

  function open(design) {
    clearTimeout(doneTimer);
    busy = false;
    el.hidden = false;
    el.classList.remove('is-saved');
    setTool('add');
    setColor('B');
    setMirror(true);
    setStep('build');
    if (bestiary.isVoxel?.(design)) load(bestiary.normalizeDesign(design), bestiary.normalizeDesign(design).voxels);
    else if (design && bestiary.countBlocks(design) > 0) begin({ kind: 'drawing', design });
    else {
      load(null, null);
      start.show();
    }
    dirty = !!design && !bestiary.isVoxel?.(design);
  }

  function close() {
    clearTimeout(doneTimer);
    busy = false;
    view.hide();
    start.hide();
    el.hidden = true;
  }

  setTool('add');
  return {
    el,
    grid,
    open,
    close,
    getDesign: currentDesign,
    get isOpen() {
      return !el.hidden;
    },
    get edit() {
      return edit;
    },
    destroy() {
      close();
      detachKeys();
      view.dispose();
      slice.destroy();
      placer.destroy();
      preview?.dispose?.();
      el.remove();
    },
  };
}
