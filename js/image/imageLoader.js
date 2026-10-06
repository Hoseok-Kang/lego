// 사진 불러오기
// 파일 고르기, 화면에 끌어다 놓기, 붙여넣기(Ctrl+V) 세 가지 방법을 처리합니다.
// 사진을 읽으면 onImage(그림, 파일이름)을, 문제가 생기면 onError(안내 문구)를 부릅니다.

const MAX_FILE_MB = 30;

export function setupImageInputs({ fileInput, dropOverlay, onImage, onError }) {
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) handleFile(file);
    fileInput.value = ''; // 같은 파일을 다시 골라도 동작하도록 비움
  });

  let dragDepth = 0;
  window.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    dropOverlay.hidden = false;
  });
  window.addEventListener('dragover', (event) => {
    if (hasFiles(event)) event.preventDefault();
  });
  window.addEventListener('dragleave', (event) => {
    if (!hasFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropOverlay.hidden = true;
  });
  window.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    dropOverlay.hidden = true;
    const files = Array.from(event.dataTransfer.files);
    const file = files.find(isImageFile) ?? files[0];
    if (file) handleFile(file);
  });

  window.addEventListener('paste', (event) => {
    const items = Array.from(event.clipboardData?.items ?? []);
    const item = items.find((entry) => entry.type.startsWith('image/'));
    if (!item) return;
    event.preventDefault();
    handleFile(item.getAsFile());
  });

  async function handleFile(file) {
    if (!isImageFile(file)) {
      onError('그림 파일이 아니에요. JPG나 PNG 같은 사진을 올려 주세요.');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      onError(`사진이 너무 커요. ${MAX_FILE_MB}MB보다 작은 사진을 올려 주세요.`);
      return;
    }
    try {
      onImage(await decodeImage(file), file.name);
    } catch {
      onError('이 사진은 열 수 없어요. JPG나 PNG로 바꿔서 다시 올려 주세요.');
    }
  }
}

export async function decodeImage(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // 아래의 다른 방법으로 다시 시도
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function hasFiles(event) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function isImageFile(file) {
  if (!file) return false;
  return file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(file.name ?? '');
}
