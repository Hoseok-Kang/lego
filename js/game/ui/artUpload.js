// 내 그림 넣기 창
// 사진 한 장을 골라(파일 고르기 · 창에 끌어다 놓기 · 붙여넣기) 성, 타워, 몬스터 중 어디에 쓸지 정합니다.
// 사진이 블록으로 바뀌면 어떻게 보일지 바로 옆에 미리 보여 줍니다.
// 문구와 틀은 game.html 의 #artDialog 와 #artRoleTemplate, 모양은 css/game.css 의 '9. 내 그림 넣기 창' 에 있습니다.
//
//   const artUpload = createArtUpload({ roles, hasCustom(id), onApply(roleId, 그림), onReset(roleId) })
//   artUpload.open()    창 열기
//   artUpload.close()   창 닫기
//   roles: [{ id, label }]   그림을 쓸 수 있는 자리 목록 (core/artLibrary.js 의 ART_ROLES)
// [적용] 을 누르면 await onApply(자리, 그림) 이 끝난 뒤 창이 닫힙니다.

import { decodeImage } from '../../image/imageLoader.js';
import { pixelate } from '../../image/pixelator.js';
import { quantizeGrid } from '../../bricks/colorMatcher.js';
import { BRICK_COLORS } from '../../bricks/brickColors.js';
import { GAME } from '../gameConfig.js';

const MAX_FILE_MB = 30; // 이보다 큰 사진은 받지 않음

// 자리 목록을 묶어 보여 줄 제목 (자리 id 가 이 글자로 시작하면 그 묶음에 들어감)
const ROLE_GROUPS = [
  { prefix: 'castle', title: '성' },
  { prefix: 'tower:', title: '타워' },
  { prefix: 'monster:', title: '몬스터' },
];
const OTHER_GROUP_TITLE = '기타';

// 안내 문구
const MESSAGES = {
  notImage: '그림 파일이 아니에요. JPG나 PNG 같은 사진을 올려 주세요.',
  tooBig: `사진이 너무 커요. ${MAX_FILE_MB}MB보다 작은 사진을 올려 주세요.`,
  unreadable: '이 사진은 열 수 없어요. JPG나 PNG로 바꿔서 다시 올려 주세요.',
  applyFailed: '그림을 바꾸지 못했어요. 다른 사진으로 다시 해 보세요.',
};

export function createArtUpload({ roles, hasCustom, onApply, onReset }) {
  const el = (id) => document.getElementById(id);
  const ui = {
    dialog: el('artDialog'),
    closeBtn: el('artCloseBtn'),
    cancelBtn: el('artCancelBtn'),
    applyBtn: el('artApplyBtn'),
    drop: el('artDrop'),
    empty: el('artEmpty'),
    preview: el('artPreview'),
    previewImage: el('artPreviewImage'),
    previewBlocks: el('artPreviewBlocks'),
    pickBtn: el('artPickBtn'),
    repickBtn: el('artRepickBtn'),
    fileInput: el('artFileInput'),
    roles: el('artRoles'),
    roleTemplate: el('artRoleTemplate'),
    error: el('artError'),
  };

  const state = {
    image: null, // 고른 사진 (ImageBitmap 또는 <img>)
    roleId: roles[0]?.id ?? null,
    busy: false,
    dragDepth: 0,
  };

  // ── 자리 목록 만들기 ──
  const rows = new Map(); // roleId → { input, badge, reset }
  buildRoleList();

  function buildRoleList() {
    const groups = new Map();
    for (const role of roles) {
      const group = ROLE_GROUPS.find(({ prefix }) => role.id.startsWith(prefix));
      const title = group ? group.title : OTHER_GROUP_TITLE;
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title).push(role);
    }
    const sections = [];
    for (const [title, list] of groups) {
      const section = document.createElement('div');
      section.className = 'role-group';
      const heading = document.createElement('p');
      heading.className = 'role-group-title';
      heading.textContent = title;
      section.append(heading);
      for (const role of list) section.append(createRoleRow(role));
      sections.push(section);
    }
    ui.roles.replaceChildren(...sections);
  }

  function createRoleRow(role) {
    const row = ui.roleTemplate.content.firstElementChild.cloneNode(true);
    const input = row.querySelector('input');
    const badge = row.querySelector('.role-badge');
    const reset = row.querySelector('.role-reset');
    input.value = role.id;
    input.id = `artRole-${role.id.replace(/[^a-z0-9]/gi, '-')}`;
    row.querySelector('.role-name').textContent = role.label;
    input.addEventListener('change', () => {
      if (!input.checked) return;
      state.roleId = role.id;
      drawBlockPreview();
    });
    reset.addEventListener('click', () => {
      onReset?.(role.id);
      refreshRoleStatus();
    });
    rows.set(role.id, { input, badge, reset });
    return row;
  }

  // '내 그림 사용 중' 표시와 [기본 그림으로] 버튼 다시 그리기
  function refreshRoleStatus() {
    for (const [id, row] of rows) {
      const custom = Boolean(hasCustom?.(id));
      row.badge.hidden = !custom;
      row.reset.hidden = !custom;
      row.input.checked = id === state.roleId;
    }
  }

  // ── 창 열기/닫기 ──
  function open() {
    refreshRoleStatus();
    showError('');
    updateApply();
    if (ui.dialog.open) return;
    if (typeof ui.dialog.showModal === 'function') ui.dialog.showModal();
    else ui.dialog.setAttribute('open', '');
    (state.image ? ui.applyBtn : ui.pickBtn).focus({ preventScroll: true });
  }

  function close() {
    if (!ui.dialog.open) return;
    if (typeof ui.dialog.close === 'function') ui.dialog.close();
    else ui.dialog.removeAttribute('open');
  }

  ui.dialog.addEventListener('close', () => {
    state.dragDepth = 0;
    ui.drop.classList.remove('is-dragging');
  });
  ui.closeBtn.addEventListener('click', close);
  ui.cancelBtn.addEventListener('click', close);

  // 창 바깥(어두운 막)을 누르면 닫기
  let downOnBackdrop = false;
  ui.dialog.addEventListener('pointerdown', (event) => {
    downOnBackdrop = event.target === ui.dialog;
  });
  ui.dialog.addEventListener('click', (event) => {
    if (downOnBackdrop && event.target === ui.dialog) close();
    downOnBackdrop = false;
  });

  // ── 사진 받기: 파일 고르기 · 끌어다 놓기 · 붙여넣기 ──
  const pickFile = () => ui.fileInput.click();
  ui.pickBtn.addEventListener('click', pickFile);
  ui.repickBtn.addEventListener('click', pickFile);
  ui.fileInput.addEventListener('change', () => {
    const file = ui.fileInput.files && ui.fileInput.files[0];
    if (file) handleFile(file);
    ui.fileInput.value = ''; // 같은 파일을 다시 골라도 동작하도록 비움
  });

  ui.dialog.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    state.dragDepth += 1;
    ui.drop.classList.add('is-dragging');
  });
  ui.dialog.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  ui.dialog.addEventListener('dragleave', (event) => {
    if (!hasFiles(event)) return;
    state.dragDepth = Math.max(0, state.dragDepth - 1);
    if (state.dragDepth === 0) ui.drop.classList.remove('is-dragging');
  });
  ui.dialog.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    state.dragDepth = 0;
    ui.drop.classList.remove('is-dragging');
    const files = Array.from(event.dataTransfer.files);
    const file = files.find(isImageFile) ?? files[0];
    if (file) handleFile(file);
  });

  window.addEventListener('paste', (event) => {
    if (!ui.dialog.open) return;
    const items = Array.from(event.clipboardData?.items ?? []);
    const item = items.find((entry) => entry.kind === 'file' && entry.type.startsWith('image/'));
    if (!item) return;
    event.preventDefault();
    handleFile(item.getAsFile());
  });

  async function handleFile(file) {
    if (state.busy) return;
    if (!isImageFile(file)) {
      showError(MESSAGES.notImage);
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      showError(MESSAGES.tooBig);
      return;
    }
    let image;
    try {
      image = await decodeImage(file);
    } catch {
      showError(MESSAGES.unreadable);
      return;
    }
    setImage(image);
  }

  function setImage(image) {
    if (state.image && state.image !== image) state.image.close?.(); // 쓰지 않을 사진의 메모리 돌려주기
    state.image = image;
    showError('');
    const hasImage = Boolean(image);
    ui.empty.hidden = hasImage;
    ui.preview.hidden = !hasImage;
    ui.repickBtn.hidden = !hasImage;
    if (hasImage) {
      drawImagePreview();
      drawBlockPreview();
    }
    updateApply();
  }

  // ── 적용 ──
  ui.applyBtn.addEventListener('click', async () => {
    if (!state.image || !state.roleId || state.busy) return;
    setBusy(true);
    try {
      await onApply?.(state.roleId, state.image);
      state.image = null; // 넘겨준 사진은 게임이 씀 (여기서 닫지 않음)
      setImage(null);
      setBusy(false);
      close();
    } catch {
      setBusy(false);
      showError(MESSAGES.applyFailed);
    }
  });

  function setBusy(busy) {
    state.busy = busy;
    ui.applyBtn.dataset.busy = String(busy);
    updateApply();
  }

  function updateApply() {
    ui.applyBtn.disabled = state.busy || !state.image || !state.roleId;
  }

  function showError(text) {
    ui.error.textContent = text;
  }

  // ── 미리보기 ──
  // 올린 사진: 네모 칸 안에 비율을 지켜 맞춤
  function drawImagePreview() {
    const { ctx, size } = prepareCanvas(ui.previewImage);
    const width = state.image.naturalWidth || state.image.width;
    const height = state.image.naturalHeight || state.image.height;
    const scale = Math.min(size / width, size / height);
    const w = width * scale;
    const h = height * scale;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(state.image, (size - w) / 2, (size - h) / 2, w, h);
  }

  // 블록으로 바꾼 모습: 게임과 같은 방법(pixelate → 블록 색 맞추기)으로 칸마다 블록을 그림
  function drawBlockPreview() {
    if (!state.image) return;
    const { ctx, size } = prepareCanvas(ui.previewBlocks);
    let grid;
    try {
      grid = quantizeGrid(pixelate(state.image, previewColumns(state.roleId), { maxRows: 80, alphaThreshold: 0.5 }), BRICK_COLORS);
    } catch {
      return;
    }
    const { columns, rows: gridRows, cells } = grid;
    const cell = Math.max(2, Math.floor((size - 8) / Math.max(columns, gridRows)));
    const left = Math.round((size - cell * columns) / 2);
    const top = Math.round((size - cell * gridRows) / 2);
    const stud = cell * 0.28;
    for (let y = 0; y < gridRows; y++) {
      for (let x = 0; x < columns; x++) {
        const colorIndex = cells[y * columns + x];
        if (colorIndex === null || colorIndex === undefined) continue;
        const px = left + x * cell;
        const py = top + y * cell;
        ctx.fillStyle = BRICK_COLORS[colorIndex].hex;
        ctx.fillRect(px, py, cell, cell);
        ctx.fillStyle = 'rgba(0,0,0,0.16)'; // 칸 사이 그림자
        ctx.fillRect(px, py + cell - Math.max(1, cell * 0.12), cell, Math.max(1, cell * 0.12));
        ctx.fillRect(px + cell - Math.max(1, cell * 0.08), py, Math.max(1, cell * 0.08), cell);
        if (cell >= 6) {
          ctx.fillStyle = 'rgba(255,255,255,0.22)'; // 돌기
          ctx.beginPath();
          ctx.arc(px + cell / 2, py + cell / 2, stud, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  return { open, close };
}

// 미리보기 그림판을 화면 밀도에 맞게 비우고 준비
function prepareCanvas(canvas) {
  const size = 160;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixels = Math.round(size * ratio);
  if (canvas.width !== pixels) {
    canvas.width = pixels;
    canvas.height = pixels;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, size, size);
  return { ctx, size };
}

// 자리마다 게임에서 쓰는 가로 블록 수 (gameConfig.js 의 columns)
function previewColumns(roleId) {
  const [kind, type] = String(roleId).split(':');
  if (kind === 'castle') return GAME.castle.columns;
  if (kind === 'tower') return GAME.towers[type]?.columns ?? 8;
  if (kind === 'monster') return GAME.enemies[type]?.columns ?? 9;
  return 12;
}

function hasFiles(event) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function isImageFile(file) {
  if (!file) return false;
  return (file.type ?? '').startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(file.name ?? '');
}
