// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 처음 온 사람 안내 (첫 출전)
// 게임의 핵심 = "내가 그린 괴수가 마을을 부순다" 를 처음 1분 안에 겪게 합니다.
// 차례: 환영 카드 → 괴수 그리기 화면 → 저장하면 바로 시골 마을로 첫 출동 (공짜) → 끝나면 마무리 카드 → 소굴 (평소 첫 화면)
//
// 처음 온 사람으로 보는 조건 (모두 맞을 때)
//   · 아직 한 번도 출동하지 않았고 (save.stats.raids === 0) 그린 괴수도 없음 (save.designs 가 비어 있음)
//   · 안내를 끝낸 적이 없음 (localStorage 'villainTycoon.introDone')
//   · 녹화 모드(?capture)나 주소 끝 ?nointro 가 아님
//
// 쓰는 법 (game.js)
//   const intro = createFirstRun({ saveStore, capture })
//   intro.shouldStart()      처음 온 사람이면 true
//   intro.begin()            안내 시작 (그리기 단계)
//   intro.active             안내 중인지
//   intro.startRaid()        첫 출동 시작을 알림 → intro.inRaid 가 true
//   intro.inRaid             첫 출동 중인지 (결과 화면 대신 마무리 카드를 보여야 함)
//   intro.finish()           안내 끝 (다시는 안 나옴)
// ─────────────────────────────────────────────────────────────

const DONE_KEY = 'villainTycoon.introDone';

// 저장 공간을 못 쓰는 브라우저(비공개 창 등)에서도 멈추지 않게
function readDone() {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDone() {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    // 저장이 안 되면 다음에 또 안내가 나올 뿐이라 괜찮음
  }
}

export function createFirstRun({ saveStore, capture = false } = {}) {
  let active = false;
  let inRaid = false;
  const skipByAddress = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nointro');

  return {
    shouldStart() {
      if (capture || skipByAddress || readDone()) return false;
      const save = saveStore.getSave();
      return (save.stats?.raids ?? 0) === 0 && (save.designs?.length ?? 0) === 0;
    },
    begin() {
      active = true;
      inRaid = false;
    },
    startRaid() {
      inRaid = true;
    },
    finish() {
      if (!active) return;
      active = false;
      inRaid = false;
      writeDone();
    },
    get active() {
      return active;
    },
    get inRaid() {
      return active && inRaid;
    },
  };
}
