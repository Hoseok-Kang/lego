// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 악명 휘장 (소굴 머리줄)
// 지금 악명 단계 이름, 다음 단계까지 얼마나 남았는지 막대로 보여 줍니다. 단계가 오르면 반짝 효과.
//
// 쓰는 법
//   const badge = createNotorietyBadge({ onClick })     onClick: 휘장을 눌렀을 때 (없으면 그냥 장식)
//   badge.el                                              머리줄에 넣을 요소
//   badge.render({ notoriety, rank, nextRank })
//       rank / nextRank: { rank: 2, name: '마을의 공포', at: 400, lairSize: 10 }   (nextRank 가 없으면 최고 단계)
//
// 글자는 아래 TEXT, 모양은 css/villain-lair2.css (.rank-badge) 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { el, money, bump } from './uiKit.js';
import { rankEmblem } from './lairArt.js';

const TEXT = {
  level: (n) => `악명 ${n}단계`,
  toNext: (now, next) => `${money(now)} / ${money(next)}`,
  max: '최고 단계!',
  title: (name, left) => (left > 0 ? `${name} · 다음 단계까지 악명 ${money(left)}` : `${name} · 가장 높은 단계예요`),
};

export function createNotorietyBadge({ onClick } = {}) {
  const badge = el(`
    <button type="button" class="rank-badge" data-quiet ${onClick ? '' : 'tabindex="-1"'}>
      <span class="rank-emblem-box" data-emblem></span>
      <span class="rank-text">
        <small data-level></small>
        <b data-name></b>
      </span>
      <span class="rank-bar" aria-hidden="true"><i data-fill></i><em data-count></em></span>
    </button>`);
  if (onClick) badge.addEventListener('click', () => onClick());
  else badge.classList.add('is-static');

  let lastRank = null;
  let lastKey = '';

  function render({ notoriety = 0, rank = null, nextRank = null } = {}) {
    const r = rank ?? { rank: 0, name: '동네 말썽꾼', at: 0 };
    const key = `${notoriety}|${r.rank}|${nextRank?.at ?? '-'}`;
    if (key === lastKey) return;
    lastKey = key;
    const span = nextRank ? Math.max(1, nextRank.at - r.at) : 1;
    const ratio = nextRank ? Math.max(0, Math.min(1, (notoriety - r.at) / span)) : 1;
    badge.querySelector('[data-emblem]').innerHTML = rankEmblem(r.rank);
    badge.querySelector('[data-level]').textContent = TEXT.level(r.rank);
    badge.querySelector('[data-name]').textContent = r.name ?? '';
    badge.querySelector('[data-fill]').style.width = `${(ratio * 100).toFixed(1)}%`;
    badge.querySelector('[data-count]').textContent = nextRank ? TEXT.toNext(notoriety, nextRank.at) : TEXT.max;
    badge.classList.toggle('is-max', !nextRank);
    badge.title = TEXT.title(r.name ?? '', nextRank ? nextRank.at - notoriety : 0);
    badge.setAttribute('aria-label', `${TEXT.level(r.rank)} ${r.name ?? ''}, ${badge.querySelector('[data-count]').textContent}`);
    // 단계가 오르면 반짝
    if (lastRank !== null && r.rank > lastRank) bump(badge, 'is-rankup');
    lastRank = r.rank;
  }

  return { el: badge, render };
}
