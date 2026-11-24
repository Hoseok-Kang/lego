// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 3D 작업대: 어떻게 시작할까요? (시작 고르기 창)
// 새 3D 괴수를 만들 때 처음에 뜨는 창입니다.
//   · 빈 작업대        아무것도 없는 데서 쌓기
//   · 그림에서 시작     그림판 괴수를 골라 두께 그대로 블록으로 바꿔서 시작
//   · 기본 예시        처음부터 있는 3D 괴수(통통 펭귄 …)를 고쳐서 시작
//
// 쓰는 법
//   const start = createSculptStart(hostEl, { drawings(), examples(), thumbOf(design), onPick({ kind, design? }), onCancel() })
//     kind: 'blank' | 'drawing' | 'example'
//   start.show() / start.hide() / start.isOpen
//
// 글자는 아래 TEXT, 모양은 css/villain-sculpt2.css (.vs-start).
// ─────────────────────────────────────────────────────────────

import { icon } from '../draw/paintIcons.js';

const TEXT = {
  title: '어떻게 시작할까요?',
  blank: '빈 작업대',
  blankHint: '바닥부터 하나하나 쌓아요',
  drawing: '그림에서 시작',
  drawingHint: '그린 괴수를 두께 그대로 블록으로',
  example: '기본 예시',
  exampleHint: '귀여운 3D 괴수를 고쳐 봐요',
  pickDrawing: '어떤 그림으로 시작할까요?',
  pickExample: '어떤 예시로 시작할까요?',
  none: '아직 그림판 괴수가 없어요',
  back: '뒤로',
  cancel: '소굴로',
};

const escape = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function createSculptStart(hostEl, { drawings, examples, thumbOf, onPick, onCancel }) {
  const el = document.createElement('div');
  el.className = 'vs-start';
  el.hidden = true;
  hostEl.append(el);
  let lists = { drawing: [], example: [] };

  function home() {
    el.innerHTML = `
      <div class="vs-start-card" role="dialog" aria-modal="true" aria-label="${TEXT.title}">
        <h2>${TEXT.title}</h2>
        <div class="vs-start-choices">
          <button type="button" class="vs-start-choice" data-kind="blank">${icon('addBlock')}<b>${TEXT.blank}</b><small>${TEXT.blankHint}</small></button>
          <button type="button" class="vs-start-choice" data-kind="drawing">${icon('pencil')}<b>${TEXT.drawing}</b><small>${TEXT.drawingHint}</small></button>
          <button type="button" class="vs-start-choice" data-kind="example">${icon('cube')}<b>${TEXT.example}</b><small>${TEXT.exampleHint}</small></button>
        </div>
        <button type="button" class="pb-btn vs-start-cancel" data-act="cancel">${icon('back')}<span>${TEXT.cancel}</span></button>
      </div>`;
  }

  function choose(kind) {
    const list = kind === 'drawing' ? drawings() : examples();
    lists[kind] = list;
    if (kind === 'example' && list.length === 1) return onPick({ kind, design: list[0] });
    el.innerHTML = `
      <div class="vs-start-card vs-start-card--list" role="dialog" aria-modal="true">
        <h2>${kind === 'drawing' ? TEXT.pickDrawing : TEXT.pickExample}</h2>
        <div class="vs-start-list">
          ${list.length ? list.map((d, i) => `<button type="button" class="vs-start-item" data-pick="${kind}" data-index="${i}"><img src="${thumbOf(d)}" alt="" draggable="false"><span>${escape(d.name)}</span></button>`).join('') : `<p class="vs-start-none">${TEXT.none}</p>`}
        </div>
        <button type="button" class="pb-btn vs-start-cancel" data-act="home">${icon('back')}<span>${TEXT.back}</span></button>
      </div>`;
  }

  el.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.kind === 'blank') onPick({ kind: 'blank' });
    else if (target.dataset.kind) choose(target.dataset.kind);
    else if (target.dataset.pick) onPick({ kind: target.dataset.pick, design: lists[target.dataset.pick][Number(target.dataset.index)] });
    else if (target.dataset.act === 'home') home();
    else if (target.dataset.act === 'cancel') onCancel();
  });

  return {
    show() {
      home();
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
    },
    get isOpen() {
      return !el.hidden;
    },
  };
}
