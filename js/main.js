// 전체 조립
// 각 모듈(파일)을 불러와서 순서대로 연결합니다.
//   그림 → [pixelator] 격자 → [colorMatcher] 블록 색 → [buildPlan] 쌓기 계획
//        → [blockMeshes] 3D 블록 → [stackAnimator] 쌓기 모션 → [stage] 화면에 그리기

import { CONFIG } from './config.js';
import { BRICK_COLORS } from './bricks/brickColors.js';
import { quantizeGrid } from './bricks/colorMatcher.js';
import { createBuildPlan } from './bricks/buildPlan.js';
import { drawSampleRabbit } from './image/sampleRabbit.js';
import { setupImageInputs } from './image/imageLoader.js';
import { pixelate } from './image/pixelator.js';
import { createStage } from './scene/stage.js';
import { createBlockMeshes } from './scene/blockMeshes.js';
import { createCameraRig } from './scene/cameraRig.js';
import { createStackAnimator } from './motion/stackAnimator.js';
import { createClickSound } from './audio/clickSound.js';
import { createControlPanel } from './ui/controlPanel.js';
import { renderPartsList } from './ui/partsList.js';
import { startFrameLoop, exposeCaptureHook } from './core/frameLoop.js';

const captureMode = new URLSearchParams(location.search).has('capture');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches && !captureMode;
if (captureMode) document.body.classList.add('capture');

// 지금 고른 설정
const settings = {
  columns: CONFIG.grid.defaultColumns,
  order: CONFIG.motion.order,
  dithering: CONFIG.colors.dithering,
};
let picture = drawSampleRabbit(); // 지금 블록으로 만들 그림
let plan = null; // 지금 쌓고 있는 계획

// ── 각 모듈 만들기 ──
const stage = createStage(document.getElementById('stage'), CONFIG);
const blocks = createBlockMeshes(stage.scene, CONFIG.block);
const cameraRig = createCameraRig(stage.camera, stage.renderer.domElement, CONFIG.camera, { reduceMotion });
const sound = createClickSound(CONFIG.sound);
const animator = createStackAnimator(blocks, CONFIG.motion, {
  onLand: () => sound.playClick(),
  onComplete: () => sound.playFanfare(),
});

const panel = createControlPanel(CONFIG, {
  onSample: () => {
    picture = drawSampleRabbit();
    rebuild();
    panel.showMessage('토끼 예시를 다시 쌓아요.');
  },
  onSizeChange: (columns) => {
    settings.columns = columns;
    rebuild();
  },
  onSpeedChange: (speed) => animator.setSpeed(speed),
  onOrderChange: (order) => {
    settings.order = order;
    rebuild();
  },
  onDitherChange: (on) => {
    settings.dithering = on;
    rebuild();
  },
  onReplay: () => rebuild(),
  onFinish: () => animator.finish(),
  onSoundToggle: () => panel.setSoundOn(sound.setEnabled(!sound.isEnabled())),
});

setupImageInputs({
  fileInput: panel.fileInput,
  dropOverlay: document.getElementById('dropOverlay'),
  onImage: (image, fileName) => {
    picture = image;
    if (rebuild()) panel.showMessage(`'${fileName ?? '사진'}'을 블록으로 쌓고 있어요.`);
  },
  onError: (text) => panel.showMessage(text, true),
});

// ── 그림을 블록으로 바꾸고 처음부터 쌓기 ──
function rebuild({ animate = true } = {}) {
  const grid = pixelate(picture, settings.columns, CONFIG.grid);
  const colorGrid = quantizeGrid(grid, BRICK_COLORS, { dithering: settings.dithering });
  const nextPlan = createBuildPlan(colorGrid, { order: settings.order, depth: CONFIG.block.depth });
  if (nextPlan.blocks.length === 0) {
    panel.showMessage('그림에서 블록으로 만들 부분을 찾지 못했어요. 다른 사진을 올려 주세요.', true);
    return false;
  }
  plan = nextPlan;
  blocks.setPlan(plan, BRICK_COLORS);
  stage.fitToPlan(plan);
  cameraRig.restart(blocks.figureSize());
  animator.start(plan);
  if (!animate) animator.finish();
  panel.setStats(plan);
  renderPartsList(document.getElementById('partsList'), plan, BRICK_COLORS);
  panel.showMessage('');
  return true;
}

// ── 매 장면마다: 움직임 계산 → 카메라 → 진행 표시 ──
function update(dt) {
  animator.update(dt);
  const progress = animator.progress();
  const started = animator.startedCount();
  const builtHeight = started === 0 ? 0 : (plan.blocks[started - 1].y + 1) * CONFIG.block.size;
  cameraRig.update(dt, progress, animator.isDone(), builtHeight);
  const landed = animator.landedCount();
  const step = landed === 0 ? 0 : plan.blocks[landed - 1].y + 1;
  panel.setProgress(step, plan.rows, progress);
}

rebuild({ animate: !reduceMotion });

if (captureMode) {
  exposeCaptureHook(update, stage.render, () => ({
    done: animator.isDone(),
    progress: animator.progress(),
    landed: animator.landedCount(),
  }));
} else {
  startFrameLoop((dt) => {
    update(dt);
    stage.render();
  });
}
