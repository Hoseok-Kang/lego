// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 습격 결과 화면
// 이겼는지 졌는지, 마을을 얼마나 부쉈는지, 돈을 어떻게 벌었는지(항목별)를 보여 주고 '다시 출동' / '소굴로' 를 고르게 합니다.
// 부서진 마을 위에 겹쳐 뜹니다.
//
// 쓰는 법
//   const result = createResultScreen(root, {
//     onAgain(),          다시 출동 (돈이 모자라면 이 화면이 알림만 띄우고 부르지 않음)
//     onLair(),           소굴로
//     sound(이름),         (없어도 됨) 숫자가 올라갈 때 'coin' · 'cash' 소리를 내 달라고 부름
//   })
//   result.show(raidResult, { money, name, thumb, againCost, fame, rankUp })
//       raidResult: raidDirector 의 result { win, earned, destroyedPercent, time, bonuses:[{ id, label, amount }], cost, aborted, heroLeft,
//                   townName, heroName, notoriety }   (마을 · 영웅 이름이 없으면 꼬마 마을 · 번개 기사)
//       fame: { gained, nextName, left }  이번에 얻은 악명 · 다음 단계 이름(최고 단계면 null) · 남은 악명 (없으면 result.notoriety 만)
//       rankUp: { name, emoji, lines: ['바닷가 마을', …] }  악명 단계가 올랐으면 큰 띠로 축하 (없으면 안 보임)
//       졌을 때는 영웅에게 남은 체력(heroLeft)에 따라 도움말 한 줄을 보여 줌 (아래 CLOSE_CALL)
//       money: 지금 가진 돈 (번 돈이 이미 더해진 값),  againCost: 같은 괴수를 다시 보낼 때 값 (안 주면 raidResult.cost)
//   result.hide() / result.el
//
// 글자는 아래 TEXT, 모양은 css/villain-raid.css (결과 부분) 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { el, escapeHTML, money, coin, countTo, bump, toast, isCalm } from './uiKit.js';
import { icon } from './uiIcons.js';
import { lairIcon } from './lairArt.js';

const TEXT = {
  win: '마을 정복!',
  winSub: (hero, town) => `${town ? `${town}의 ` : ''}${hero}를 물리쳤어요. 음하하!`,
  lose: '괴수가 펑!',
  loseSub: (hero) => `${hero}에게 졌어요. 그래도 번 돈은 챙겼어요`,
  fame: (n) => `악명 +${money(n)}`,
  fameLeft: (name, left) => `${name}까지 ${money(left)}`,
  fameMax: '가장 높은 단계예요',
  rankUp: '악명 단계 UP!',
  opened: (list) => `새로 열림: ${list.join(' · ')}`,
  quit: '돌아왔어요',
  quitSub: '습격을 그만뒀어요. 번 돈은 챙겼어요',
  smashed: '마을 부서짐',
  time: '걸린 시간',
  cost: '출동 값',
  total: '번 돈',
  wallet: '가진 돈',
  profit: (n) => (n >= 0 ? `출동 값을 빼면 ${money(n)} 이득이에요` : `출동 값을 빼면 ${money(-n)} 손해예요. 더 크게 부숴 봐요`),
  tipClose: '거의 이겼어요! 부품을 하나 더 붙여 보세요',
  tipFar: '더 크게 그리면 더 튼튼해요. 부품도 사서 붙여 보세요',
  again: '다시 출동',
  lair: '소굴로',
  poor: (n) => `돈이 ${money(n)} 모자라서 다시 보낼 수 없어요`,
};

const CLOSE_CALL = 0.4; // 영웅 체력이 이 비율 아래로 남았으면 '거의 이겼어요' 도움말
const ROW_DELAY = 0.28; // 항목이 하나씩 나타나는 간격 (초)
const FIRST_DELAY = 0.55; // 첫 항목이 나타나기까지

function clock(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function createResultScreen(root, { onAgain, onLair, sound } = {}) {
  const screen = el('<section class="result" hidden aria-label="습격 결과"></section>');
  root.append(screen);
  let timers = [];
  let context = {};

  function clearTimers() {
    for (const id of timers) clearTimeout(id);
    timers = [];
  }

  function show(result = {}, info = {}) {
    clearTimers();
    const hero = result.heroName || VILLAIN.hero.name;
    const fame = info.fame ?? { gained: result.notoriety ?? 0 };
    const rankUp = info.rankUp ?? null;
    const kind = result.aborted ? 'quit' : result.win ? 'win' : 'lose';
    const bonuses = result.bonuses ?? [];
    const cost = result.cost ?? 0;
    const againCost = info.againCost ?? cost;
    const wallet = info.money ?? 0;
    const percent = Math.round(result.destroyedPercent ?? 0);
    context = { againCost, wallet };
    const title = kind === 'win' ? TEXT.win : kind === 'lose' ? TEXT.lose : TEXT.quit;
    const sub = kind === 'win' ? TEXT.winSub(hero, result.townName) : kind === 'lose' ? TEXT.loseSub(hero) : TEXT.quitSub;
    const fameNext = fame.nextName ? `<span>${escapeHTML(TEXT.fameLeft(fame.nextName, fame.left))}</span>` : fame.nextName === null ? `<span>${TEXT.fameMax}</span>` : '';
    const fameHTML = fame.gained > 0 ? `<p class="result-fame">${lairIcon('skull')}<b>${TEXT.fame(fame.gained)}</b>${fameNext}</p>` : '';
    const rankHTML = rankUp
      ? `<div class="result-rankup" role="status"><strong>${TEXT.rankUp}</strong><b>${escapeHTML(`${rankUp.emoji ?? ''} ${rankUp.name}`.trim())}</b>${rankUp.lines?.length ? `<small>${escapeHTML(TEXT.opened(rankUp.lines))}</small>` : ''}</div>`
      : '';
    const tip = kind === 'lose' ? ((result.heroLeft ?? 1) < CLOSE_CALL ? TEXT.tipClose : TEXT.tipFar) : '';
    const rows = bonuses
      .map((b, i) => `<li class="result-row" data-id="${escapeHTML(b.id ?? '')}" style="--i:${i}"><span>${escapeHTML(b.label)}</span>${coin(b.amount, { sign: true })}</li>`)
      .join('');
    screen.dataset.kind = kind;
    screen.classList.toggle('has-rankup', !!rankUp);
    screen.innerHTML = `
      <div class="result-card" style="--rows:${bonuses.length}">
        <div class="result-burst" aria-hidden="true"></div>
        <header class="result-head">
          ${info.thumb ? `<span class="result-face"><img src="${info.thumb}" alt="" draggable="false"></span>` : ''}
          <h1 class="result-title">${[...title].map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : escapeHTML(ch)}</span>`).join('')}</h1>
          <p class="result-sub">${escapeHTML(sub)}</p>
          ${tip ? `<p class="result-tip">${icon('pencil')}<span>${escapeHTML(tip)}</span></p>` : ''}
          ${fameHTML}
          ${rankHTML}
        </header>
        <div class="result-meters">
          <div class="result-meter"><span>${icon('house')}${TEXT.smashed}</span><b><i data-percent>0</i>%</b><div class="result-meter-bar" style="--to:${Math.min(100, percent)}%"><i></i></div></div>
          <div class="result-meter result-meter--time"><span>${icon('clock')}${TEXT.time}</span><b>${clock(result.time)}</b></div>
        </div>
        <ul class="result-rows">${rows}</ul>
        <div class="result-total"><span>${TEXT.total}</span><strong>${icon('coin')}<b data-total>0</b></strong></div>
        <p class="result-note"><span>${TEXT.cost} ${coin(cost)}</span><span>${TEXT.wallet} ${coin(wallet)}</span></p>
        <p class="result-profit" data-profit>${escapeHTML(TEXT.profit((result.earned ?? 0) - cost))}</p>
        <div class="result-actions">
          <button type="button" class="vt-btn vt-btn--big" data-act="lair">${icon('home')}<span>${TEXT.lair}</span></button>
          <button type="button" class="vt-btn vt-btn--big vt-btn--go" data-act="again" ${againCost > wallet ? 'aria-disabled="true"' : ''}>${icon('retry')}<span>${TEXT.again}</span>${coin(againCost)}</button>
        </div>
      </div>`;
    screen.hidden = false;
    bump(screen, 'is-enter');

    const totalEl = screen.querySelector('[data-total]');
    const percentEl = screen.querySelector('[data-percent]');
    const earned = result.earned ?? 0;
    if (isCalm()) {
      screen.classList.add('is-done');
      totalEl.textContent = money(earned);
      percentEl.textContent = String(percent);
      return;
    }
    screen.classList.remove('is-done');
    countTo(percentEl, percent, { from: 0, duration: 0.9, format: (v) => String(Math.round(v)) });
    // 항목이 하나씩 '짤랑' 하고 나타난 뒤 합계가 또르르 올라감
    bonuses.forEach((_, i) => timers.push(setTimeout(() => sound?.('coin'), (FIRST_DELAY + i * ROW_DELAY) * 1000)));
    const totalAt = FIRST_DELAY + bonuses.length * ROW_DELAY + 0.1;
    timers.push(
      setTimeout(() => {
        countTo(totalEl, earned, { from: 0, duration: 0.8 });
        bump(screen.querySelector('.result-total'), 'is-bump');
        sound?.('cash');
      }, totalAt * 1000),
    );
    timers.push(setTimeout(() => screen.classList.add('is-done'), (totalAt + 0.8) * 1000));
    if (rankUp) timers.push(setTimeout(() => sound?.('rankUp'), (totalAt + 0.9) * 1000));
  }

  screen.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    if (button.dataset.act === 'lair') return onLair?.();
    const lack = context.againCost - context.wallet;
    if (lack > 0) {
      bump(button, 'is-shake');
      toast(TEXT.poor(lack), { kind: 'bad' });
      return;
    }
    onAgain?.();
  });

  return {
    el: screen,
    show,
    hide() {
      clearTimers();
      screen.hidden = true;
    },
  };
}
