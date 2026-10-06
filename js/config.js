// ─────────────────────────────────────────────────────────────
// 설정 파일
// 여기 있는 숫자만 바꿔도 전체 동작이 바뀝니다. 다른 파일은 건드리지 않아도 됩니다.
// ─────────────────────────────────────────────────────────────

export const CONFIG = {
  // 그림을 블록 격자로 바꿀 때
  grid: {
    defaultColumns: 32, // 처음 시작할 때 가로 블록 수
    minColumns: 12, // 슬라이더 최솟값
    maxColumns: 80, // 슬라이더 최댓값 (클수록 자세하지만 블록이 많아져 느려짐)
    maxRows: 100, // 세로 블록 수 상한
    alphaThreshold: 0.5, // 0~1. 이보다 투명한 칸은 블록을 놓지 않음 (배경이 투명한 그림용)
  },

  // 블록 한 개의 모양 (블록 한 칸 = 1)
  block: {
    size: 1,
    gap: 0.04, // 블록 사이 틈
    cornerRadius: 0.08, // 모서리 둥글기
    studRadius: 0.28, // 위쪽 동그란 돌기의 반지름
    studHeight: 0.16, // 돌기 높이
    depth: 1, // 앞뒤 두께 (블록 몇 줄 두께로 쌓을지)
    roughness: 0.32, // 0이면 반짝반짝, 1이면 무광
  },

  // 블록이 떨어져 쌓이는 움직임
  motion: {
    speed: 1, // 기본 속도 배율
    secondsPerBlock: 0.009, // 블록이 하나씩 출발하는 간격(초)
    minBuildSeconds: 6, // 블록이 적어도 최소 이 시간 동안 쌓기
    maxBuildSeconds: 30, // 블록이 많아도 이 시간 안에 다 쌓기
    dropHeight: 6, // 몇 칸 위에서 떨어지는지
    fallSeconds: 0.45, // 떨어지는 데 걸리는 시간
    bounceSeconds: 0.22, // 착지한 뒤 톡 튀는 시간
    bounceHeight: 0.12, // 튀어 오르는 높이
    squash: 0.16, // 착지할 때 눌리는 정도
    maxTilt: 0.35, // 떨어질 때 기울어진 정도 (라디안)
    order: 'random', // 한 줄 안에서 쌓는 순서: random / leftToRight / centerOut / snake
  },

  // 색
  colors: {
    dithering: false, // true면 사진처럼 색을 섞어서 부드럽게 표현
  },

  // 바닥판
  ground: {
    color: '#4B9F4A', // 바닥판 색 (잔디색)
    margin: 4, // 그림 둘레로 바닥판이 더 나오는 칸 수
    thickness: 0.25, // 바닥판 두께
  },

  // 카메라 (보는 각도)
  camera: {
    fov: 32, // 화각 (작을수록 망원)
    startYawDeg: 40, // 쌓기 시작할 때 옆으로 돌아간 각도
    endYawDeg: -14, // 다 쌓았을 때 각도
    pitchDeg: 16, // 위에서 내려다보는 각도
    idleSwayDeg: 7, // 완성 후 천천히 좌우로 흔들리는 폭
    fitPadding: 1.2, // 화면에 맞출 때 여백 배율
    headroom: 8, // 쌓는 중에 쌓인 높이보다 몇 칸 위까지 화면에 담을지
  },

  // 소리
  sound: {
    minGapMs: 40, // 딸깍 소리 사이 최소 간격 (너무 시끄럽지 않게)
    volume: 0.22,
  },
};
