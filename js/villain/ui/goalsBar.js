// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 목표 띠 (소굴 위쪽, 한 번에 3개)
// 목표마다 그림 · 이름 · 진행 막대를 보여 줍니다. 누르면 설명(왜 · 어떻게)과 보상이 말풍선으로 뜹니다.
// 다 한 목표는 반짝이며 '받기!' → 누르면 도장 쾅 + 동전이 돈 주머니로 날아가고 축하 카드가 뜬 뒤 onClaim(key).
//
// 쓰는 법
//   const goals = createGoalsBar({ host, onClaim, coinTarget })
//       host: 축하 카드를 띄울 상자 (소굴 화면),  onClaim(key): 보상 받기 (없으면 '받기!' 단추 없이 완료 표시만)
//       coinTarget(): 동전이 날아갈 요소 (돈 표시)
//   goals.el
//   goals.render(목록)   목록: goalTracker.activeGoals 결과 [{ key, name, icon, emoji, desc, progress, need, done(true/false),
//                              reward: { money, notoriety }, doneText(끝냈을 때 한마디) }]
//                        (목록을 안 주면 띠를 숨김, 빈 목록이면 '모든 목표를 이뤘어요')
//   goals.celebrate(goal)   축하 카드만 띄우기 (게임이 목표를 저절로 받을 때 부름. goal.doneText 한마디를 보여 줌)
//
// 글자는 아래 TEXT, 모양은 css/villain-lair2.css (.goals, .goal, .goal-party) 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { el, escapeHTML, money, coin, bump, isCalm } from './uiKit.js';
import { artOf, lairIcon } from './lairArt.js';

const TEXT = {
  title: '목표',
  claim: '받기!',
  done: '완료!',
  party: '목표 달성!',
  reward: '보상',
  notoriety: (n) => `악명 +${money(n)}`,
  progress: (p, n) => `${money(Math.min(p, n))} / ${money(n)}`,
  empty: '모든 목표를 이뤘어요! 진짜 대마왕이에요',
  close: '닫기',
};

const CLAIM_MS = 720; // 도장 · 동전 효과가 끝나고 onClaim 을 부를 때까지
const PARTY_MS = 2600; // 축하 카드가 떠 있는 시간

const isDone = (g) => g.done === true || (typeof g.done === 'string' && g.progress >= g.need) || (g.need > 0 && g.progress >= g.need);
const quipOf = (g) => g.quip ?? g.doneText ?? (typeof g.done === 'string' ? g.done : '');

function rewardHTML(reward = {}) {
  const parts = [];
  if (reward.money) parts.push(coin(reward.money, { sign: true }));
  if (reward.notoriety) parts.push(`<span class="goal-noto">${lairIcon('skull')}<b>${TEXT.notoriety(reward.notoriety)}</b></span>`);
  return parts.join('');
}

export function createGoalsBar({ host = null, onClaim = null, coinTarget = null } = {}) {
  const bar = el(`
    <section class="goals" aria-label="${TEXT.title}">
      <h2 class="goals-title">${lairIcon('trophy')}${TEXT.title}</h2>
      <ol class="goals-list" data-list></ol>
      <div class="goal-pop" data-pop role="dialog" hidden></div>
    </section>`);
  const list = bar.querySelector('[data-list]');
  const pop = bar.querySelector('[data-pop]');
  let goals = [];
  let known = new Set(); // 이미 보여 준 목표 (새로 생긴 것만 미끄러져 들어오게)
  let openKey = null;
  let lastSig = '';
  const claiming = new Set();

  function chipHTML(g, index) {
    const done = isDone(g);
    const ratio = g.need > 0 ? Math.max(0, Math.min(1, g.progress / g.need)) : done ? 1 : 0;
    const claimable = done && !!onClaim;
    const fresh = known.size > 0 && !known.has(g.key);
    return `
      <li class="goal${done ? ' is-done' : ''}${claimable ? ' is-claimable' : ''}${fresh ? ' is-new' : ''}${claiming.has(g.key) ? ' is-claiming' : ''}" data-key="${escapeHTML(g.key)}" style="--p:${ratio.toFixed(3)};--i:${index}">
        <button type="button" class="goal-btn" data-act="${claimable ? 'claim' : 'open'}" aria-expanded="${openKey === g.key}">
          <span class="goal-icon">${artOf(g)}</span>
          <span class="goal-text">
            <b class="goal-name">${escapeHTML(g.name)}</b>
            <small class="goal-desc">${escapeHTML(g.desc ?? '')}</small>
            <span class="goal-meter"><span class="goal-bar"><i></i></span><em>${done ? TEXT.done : TEXT.progress(g.progress ?? 0, g.need ?? 1)}</em></span>
          </span>
          ${claimable ? `<span class="goal-claim">${lairIcon('gift')}${TEXT.claim}</span>` : done ? `<span class="goal-check">${lairIcon('check')}</span>` : ''}
          <span class="goal-stamp" aria-hidden="true">${TEXT.done}</span>
        </button>
      </li>`;
  }

  function render(next) {
    bar.hidden = !Array.isArray(next); // 목표 목록을 안 주면 띠를 숨김 (빈 목록이면 '다 이뤘어요')
    goals = Array.isArray(next) ? next : [];
    const sig = JSON.stringify(goals.map((g) => [g.key, g.name, g.progress, g.need, isDone(g), g.icon])) + [...claiming].join();
    if (sig === lastSig) return;
    lastSig = sig;
    list.innerHTML = goals.length ? goals.map(chipHTML).join('') : `<li class="goal goal--empty"><span>${TEXT.empty}</span></li>`;
    known = new Set(goals.map((g) => g.key));
    if (openKey && !goals.some((g) => g.key === openKey)) closePop();
    else if (openKey) openPop(openKey);
  }

  function openPop(key) {
    const g = goals.find((x) => x.key === key);
    if (!g) return closePop();
    openKey = key;
    pop.innerHTML = `
      <div class="goal-pop-head">${artOf(g)}<b>${escapeHTML(g.name)}</b></div>
      <p>${escapeHTML(g.desc ?? '')}</p>
      <p class="goal-pop-foot"><span class="goal-pop-progress">${TEXT.progress(g.progress ?? 0, g.need ?? 1)}</span>${rewardHTML(g.reward) ? `<span class="goal-pop-reward"><small>${TEXT.reward}</small>${rewardHTML(g.reward)}</span>` : ''}</p>`;
    pop.hidden = false;
    const index = goals.indexOf(g);
    pop.style.setProperty('--at', String(index));
    for (const b of list.querySelectorAll('.goal-btn')) b.setAttribute('aria-expanded', String(b.closest('.goal')?.dataset.key === key));
  }

  function closePop() {
    openKey = null;
    pop.hidden = true;
    for (const b of list.querySelectorAll('.goal-btn')) b.setAttribute('aria-expanded', 'false');
  }

  // 동전이 돈 주머니로 날아감
  function flyCoins(fromEl, count = 7) {
    const target = coinTarget?.();
    if (!fromEl || !target || isCalm()) return;
    const a = fromEl.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    for (let i = 0; i < count; i += 1) {
      const c = el(`<span class="fly-coin">${coin(0).replace(/<b>.*<\/b>/, '')}</span>`);
      document.body.append(c);
      const x0 = a.left + a.width * (0.3 + Math.random() * 0.4);
      const y0 = a.top + a.height * 0.5;
      const x1 = b.left + b.width * 0.25;
      const y1 = b.top + b.height * 0.5;
      const lift = 60 + Math.random() * 50;
      const anim = c.animate(
        [
          { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0 },
          { transform: `translate(${x0 + (Math.random() - 0.5) * 70}px, ${y0 - lift}px) scale(1.2)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${x1}px, ${y1}px) scale(0.7)`, opacity: 1 },
        ],
        { duration: 620 + i * 55, delay: i * 40, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' },
      );
      anim.onfinish = () => {
        c.remove();
        if (i === count - 1) bump(target, 'is-bump');
      };
    }
  }

  // 축하 카드 (색종이 블록이 터짐)
  let partyTimer = 0;
  function celebrate(goal) {
    if (!goal || !host) return;
    host.querySelector(':scope > .goal-party')?.remove();
    const confetti = isCalm() ? '' : Array.from({ length: 14 }, (_, i) => `<i style="--a:${(i / 14) * 360}deg;--d:${90 + (i % 4) * 30}px;--c:${['#BBE90B', '#F2CD37', '#FF698F', '#9FC3E9', '#AC78BA'][i % 5]}"></i>`).join('');
    const party = el(`
      <div class="goal-party" role="status" aria-live="polite">
        <div class="goal-party-card">
          <span class="goal-party-burst" aria-hidden="true">${confetti}</span>
          <span class="goal-party-stamp">${TEXT.party}</span>
          <span class="goal-party-icon">${artOf(goal)}</span>
          <b class="goal-party-name">${escapeHTML(goal.name ?? '')}</b>
          ${quipOf(goal) ? `<p class="goal-party-quip">${escapeHTML(quipOf(goal))}</p>` : ''}
          ${rewardHTML(goal.reward) ? `<p class="goal-party-reward">${rewardHTML(goal.reward)}</p>` : ''}
        </div>
      </div>`);
    party.addEventListener('click', () => party.remove());
    host.append(party);
    clearTimeout(partyTimer);
    partyTimer = setTimeout(() => party.remove(), isCalm() ? 1600 : PARTY_MS);
  }

  function claim(key, chip) {
    if (claiming.has(key)) return;
    const goal = goals.find((g) => g.key === key);
    if (!goal) return;
    claiming.add(key);
    chip.classList.add('is-claiming');
    if (goal.reward?.money) flyCoins(chip);
    celebrate(goal);
    setTimeout(() => {
      claiming.delete(key);
      lastSig = '';
      onClaim?.(key);
    }, isCalm() ? 0 : CLAIM_MS);
  }

  bar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const chip = button.closest('.goal');
    const key = chip?.dataset.key;
    if (!key) return;
    if (button.dataset.act === 'claim') {
      closePop();
      claim(key, chip);
    } else if (openKey === key) closePop();
    else openPop(key);
  });
  pop.addEventListener('click', () => closePop());
  // 바깥을 누르면 말풍선 닫기
  document.addEventListener('pointerdown', (event) => {
    if (openKey && !bar.contains(event.target)) closePop();
  });

  return { el: bar, render, celebrate, closePop };
}
