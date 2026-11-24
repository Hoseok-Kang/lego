// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 첫 출전 안내 카드 (환영 카드 · 마무리 카드)
// 화면 가운데에 뜨는 카드 두 장입니다. 모양은 css/villain-intro.css, 글자는 아래 TEXT 에서 바꿉니다.
//
// 쓰는 법
//   showWelcome(host, { thumb, onGo })                 처음 들어왔을 때: "첫 괴수를 그려요" → [괴수 그리러 가기]
//   showEnding(host, { result, name, thumb, onGo })    첫 출동이 끝났을 때: 졌어요/이겼어요 → [소굴로 가기]
//       result: 습격 결과 { win, aborted, earned, destroyedPercent, heroName }
//   두 함수 모두 카드를 닫는 함수를 돌려줍니다.
// ─────────────────────────────────────────────────────────────
import { el, escapeHTML, money } from '../ui/uiKit.js';
import { L } from '../lang/lang.js';

const TEXT = L({
  ko: {
    welcomeTitle: '악당님, 어서 오세요!',
    welcomeText: '마을을 부술 첫 괴수를 직접 그려 보세요. 다 그리면 바로 시골 마을로 출동해요!',
    steps: ['칸을 칠해 괴수 그리기', '공격 부품 붙이기', '저장하면 바로 출동!'],
    free: '첫 출동은 공짜예요',
    go: '괴수 그리러 가기',
    loseTitle: '앗, 영웅에게 졌어요!',
    loseText: (r) => `${r.heroName || '영웅'}에게 졌지만, 마을을 ${r.destroyedPercent ?? 0}% 부숴서 ${money(r.earned ?? 0)}원을 벌었어요.`,
    loseMore: '진짜 악당은 포기하지 않죠. 소굴을 키워서 복수해요!',
    winTitle: '첫 출동부터 마을 정복!',
    winText: (r) => `마을을 ${r.destroyedPercent ?? 0}% 부수고 ${money(r.earned ?? 0)}원을 벌었어요. 타고난 악당이네요!`,
    winMore: '이제 소굴을 키워서 더 큰 마을로 가요!',
    quitTitle: '출동을 멈췄어요',
    quitText: '괜찮아요! 소굴에서 준비해서 다시 가요.',
    quitMore: '그린 괴수는 괴수 도감에 들어 있어요.',
    toLair: '소굴로 가기',
  },
  en: {
    welcomeTitle: 'Welcome, Villain!',
    welcomeText: "Draw your very first monster to smash a town. When it's done, it goes straight to raid Tiny Town!",
    steps: ['Paint blocks to draw a monster', 'Stick on attack parts', 'Save and it attacks!'],
    free: 'Your first raid is free',
    go: 'Draw a monster',
    loseTitle: 'Oops, the hero won!',
    loseText: (r) => `${r.heroName || 'The hero'} won, but you smashed ${r.destroyedPercent ?? 0}% of the town and earned ${money(r.earned ?? 0)} coins.`,
    loseMore: 'Real villains never give up. Grow your lair and get revenge!',
    winTitle: 'Conquered on your first raid!',
    winText: (r) => `You smashed ${r.destroyedPercent ?? 0}% of the town and earned ${money(r.earned ?? 0)} coins. A born villain!`,
    winMore: 'Now grow your lair and go for bigger towns!',
    quitTitle: 'Raid stopped',
    quitText: "That's OK! Get ready in your lair and try again.",
    quitMore: 'Your monster is waiting in the Monster Book.',
    toLair: 'Go to the lair',
  },
});

// 카드 하나를 띄우고, 단추를 누르면 닫고 onGo 를 부름
function showCard(host, html, onGo) {
  host.querySelector(':scope > .intro-veil')?.remove();
  const veil = el(`<div class="intro-veil">${html}</div>`);
  const close = () => veil.remove();
  veil.querySelector('[data-go]').addEventListener('click', () => {
    close();
    onGo?.();
  });
  host.append(veil);
  veil.querySelector('[data-go]').focus({ preventScroll: true });
  return close;
}

function faceHTML(thumb) {
  return thumb ? `<img class="intro-face" src="${thumb}" alt="">` : '';
}

export function showWelcome(host, { thumb = '', onGo } = {}) {
  const steps = TEXT.steps.map((s, i) => `<li><b>${i + 1}</b><span>${escapeHTML(s)}</span></li>`).join('');
  return showCard(
    host,
    `<div class="intro-card intro-card--welcome" role="dialog" aria-modal="true" aria-labelledby="introTitle">
      ${faceHTML(thumb)}
      <div class="intro-body">
        <h2 class="intro-title" id="introTitle">${TEXT.welcomeTitle}</h2>
        <p class="intro-text">${TEXT.welcomeText}</p>
        <ol class="intro-steps">${steps}</ol>
        <div class="intro-actions">
          <span class="intro-chip">${TEXT.free}</span>
          <button type="button" class="vt-btn vt-btn--go intro-go" data-go>${TEXT.go}</button>
        </div>
      </div>
    </div>`,
    onGo,
  );
}

export function showEnding(host, { result = {}, name = '', thumb = '', onGo } = {}) {
  const kind = result.aborted ? 'quit' : result.win ? 'win' : 'lose';
  const title = TEXT[`${kind}Title`];
  const text = kind === 'quit' ? TEXT.quitText : TEXT[`${kind}Text`](result);
  const more = TEXT[`${kind}More`];
  return showCard(
    host,
    `<div class="intro-card intro-card--${kind}" role="dialog" aria-modal="true" aria-labelledby="introTitle">
      ${faceHTML(thumb)}
      <div class="intro-body">
        <h2 class="intro-title" id="introTitle">${title}</h2>
        ${name ? `<p class="intro-name">${escapeHTML(name)}</p>` : ''}
        <p class="intro-text">${escapeHTML(text)}</p>
        <p class="intro-more">${more}</p>
        <div class="intro-actions">
          <button type="button" class="vt-btn vt-btn--go intro-go" data-go>${TEXT.toLair}</button>
        </div>
      </div>
    </div>`,
    onGo,
  );
}
