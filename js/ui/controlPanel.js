// 조작판
// 오른쪽(휴대폰에서는 아래쪽) 버튼·슬라이더를 프로그램 동작과 연결합니다.
// 화면 글자를 바꾸고 싶으면 index.html을, 동작을 바꾸고 싶으면 main.js를 보면 됩니다.

import { BUILD_ORDERS } from '../bricks/buildPlan.js';

export function createControlPanel(config, handlers) {
  const el = (id) => document.getElementById(id);
  const ui = {
    uploadBtn: el('uploadBtn'),
    fileInput: el('fileInput'),
    sampleBtn: el('sampleBtn'),
    sizeRange: el('sizeRange'),
    sizeValue: el('sizeValue'),
    speedRange: el('speedRange'),
    speedValue: el('speedValue'),
    orderOptions: el('orderOptions'),
    ditherToggle: el('ditherToggle'),
    replayBtn: el('replayBtn'),
    finishBtn: el('finishBtn'),
    soundBtn: el('soundBtn'),
    stepNow: el('stepNow'),
    stepTotal: el('stepTotal'),
    progressFill: el('progressFill'),
    blockCount: el('blockCount'),
    colorCount: el('colorCount'),
    gridSize: el('gridSize'),
    message: el('message'),
  };

  // 처음 값 채우기
  ui.sizeRange.min = config.grid.minColumns;
  ui.sizeRange.max = config.grid.maxColumns;
  ui.sizeRange.value = config.grid.defaultColumns;
  ui.speedRange.value = config.motion.speed;
  ui.ditherToggle.checked = config.colors.dithering;
  renderOrderOptions(ui.orderOptions, config.motion.order);
  showSize(config.grid.defaultColumns);
  showSpeed(config.motion.speed);

  // 버튼과 슬라이더 연결
  ui.uploadBtn.addEventListener('click', () => ui.fileInput.click());
  ui.sampleBtn.addEventListener('click', () => handlers.onSample());
  ui.sizeRange.addEventListener('input', () => showSize(Number(ui.sizeRange.value)));
  ui.sizeRange.addEventListener('change', () => handlers.onSizeChange(Number(ui.sizeRange.value)));
  ui.speedRange.addEventListener('input', () => {
    const speed = Number(ui.speedRange.value);
    showSpeed(speed);
    handlers.onSpeedChange(speed);
  });
  ui.orderOptions.addEventListener('change', (event) => handlers.onOrderChange(event.target.value));
  ui.ditherToggle.addEventListener('change', () => handlers.onDitherChange(ui.ditherToggle.checked));
  ui.replayBtn.addEventListener('click', () => handlers.onReplay());
  ui.finishBtn.addEventListener('click', () => handlers.onFinish());
  ui.soundBtn.addEventListener('click', () => handlers.onSoundToggle());

  function showSize(columns) {
    ui.sizeValue.textContent = `${columns}칸`;
  }

  function showSpeed(speed) {
    ui.speedValue.textContent = `${speed}×`;
  }

  let lastStep = -1;
  let lastFill = -1;
  return {
    fileInput: ui.fileInput,

    // 진행 상황: 몇 번째 단(줄)을 쌓는 중인지 + 진행 막대
    setProgress(step, totalSteps, fraction) {
      if (step !== lastStep) {
        ui.stepNow.textContent = step;
        ui.stepTotal.textContent = totalSteps;
        lastStep = step;
      }
      const fill = Math.round(fraction * 1000) / 10;
      if (fill !== lastFill) {
        ui.progressFill.style.width = `${fill}%`;
        lastFill = fill;
      }
    },

    setStats(plan) {
      ui.blockCount.textContent = plan.blocks.length.toLocaleString('ko-KR');
      ui.colorCount.textContent = plan.colorCounts.length;
      ui.gridSize.textContent = `가로 ${plan.columns} × 세로 ${plan.rows}칸`;
    },

    setSoundOn(on) {
      ui.soundBtn.setAttribute('aria-pressed', String(on));
      ui.soundBtn.textContent = on ? '소리 끄기' : '소리 켜기';
    },

    showMessage(text, isError = false) {
      ui.message.textContent = text;
      ui.message.classList.toggle('is-error', isError);
    },
  };
}

function renderOrderOptions(container, selected) {
  container.replaceChildren(
    ...Object.entries(BUILD_ORDERS).map(([value, label]) => {
      const option = document.createElement('label');
      option.className = 'segment';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'order';
      input.id = `order-${value}`;
      input.value = value;
      input.checked = value === selected;
      const text = document.createElement('span');
      text.textContent = label;
      option.append(input, text);
      return option;
    }),
  );
}
