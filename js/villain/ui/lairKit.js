// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 소굴 화면들이 함께 쓰는 작은 도구
// 효과 숫자를 '출동 값 -6%' 같은 글로 바꾸기, 잠긴 이유 글, 계책 조건 그림, 판(시트) 머리줄 같은 것입니다.
//
// 쓰는 법
//   describeEffect({ cost: -0.06 }, 2) → [{ key:'cost', label:'출동 값', value:'-12%', good:true }]   (2 = 레벨 배수)
//   effectChips(목록, { empty })       위 목록 → 초록(좋음) · 빨강(나쁨) 칩 HTML
//   lockText(단계, ranks)              '악명 2단계(마을의 공포)에 열려요'
//   unlockLines(def)                  연구실처럼 레벨마다 여는 것 → [{ level, html }]
//   facilityChip(key, facilities)      시설 그림 + 이름 칩 HTML
//   needChips(need, facilities)        계책 조건 'f:paint' 또는 태그 '물' → 그 시설들의 칩 HTML
//   schemeOf(key, schemes) / facilityOf(key, facilities)   목록에서 찾기
//   sheetHead({ icon, title, sub })    판 머리줄 (제목 + 닫기 단추) HTML
//   signature(값)                       같은 내용이면 다시 안 그리려고 쓰는 짧은 글
//   makeThumbs(thumbOf) → (design) → 그림 주소   괴수 카드 그림 (한 번 그린 것은 기억)
//   partIcons(design)                  괴수에 붙인 부품 아이콘 HTML
//
// 효과 이름 글자는 아래 EFFECT_LABELS 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { escapeHTML, coin } from './uiKit.js';
import { art, lairIcon } from './lairArt.js';
import { partIconURL } from '../draw/partIcons.js';
import { designThumbURL } from '../draw/pixelThumb.js';
import { VILLAIN } from '../villainConfig.js';

export const EFFECT_LABELS = {
  cost: '출동 값',
  hp: '괴수 체력',
  dmg: '괴수 공격',
  partDmg: '부품 공격',
  smash: '부수는 힘',
  pay: '습격 수입',
  notoriety: '악명 얻기',
  heroHp: '영웅 체력',
  heroDelay: '영웅 늦게 오기',
  raidBonus: '습격 보너스',
  partSlots: '부품 칸',
};

const LOWER_IS_GOOD = new Set(['cost', 'heroHp']); // 줄어들수록 좋은 것

const percent = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))}%`;

export function describeEffect(effect = {}, scale = 1) {
  const out = [];
  for (const [key, raw] of Object.entries(effect ?? {})) {
    if (!(key in EFFECT_LABELS) || typeof raw !== 'number' || !raw) continue;
    const v = raw * scale;
    let value;
    if (key === 'raidBonus') value = `${v > 0 ? '+' : ''}${Math.round(v)}원`;
    else if (key === 'partSlots') value = `+${Math.round(v)}칸`;
    else value = percent(v);
    out.push({ key, label: EFFECT_LABELS[key], value, good: LOWER_IS_GOOD.has(key) ? v < 0 : v > 0 });
  }
  return out;
}

export function effectChips(list, { empty = '', className = '' } = {}) {
  if (!list?.length) return empty ? `<span class="fx-chip is-none">${escapeHTML(empty)}</span>` : '';
  return list
    .map((e) => `<span class="fx-chip ${e.good === false ? 'is-bad' : 'is-good'} ${className}"><small>${escapeHTML(e.label)}</small><b>${escapeHTML(e.value)}</b></span>`)
    .join('');
}

export function rankName(rank, ranks) {
  return (ranks ?? []).find((r) => r.rank === rank)?.name ?? '';
}

export function lockText(rank, ranks) {
  const name = rankName(rank, ranks);
  return `악명 ${rank}단계${name ? `(${name})` : ''}에 열려요`;
}

export function facilityOf(key, facilities) {
  return (facilities ?? []).find((f) => f.key === key) ?? null;
}

export function schemeOf(key, schemes) {
  return (schemes ?? []).find((s) => s.key === key) ?? null;
}

// 'f:paint' → 물감 창고 하나,  '물' → 태그가 '물' 인 시설 모두
export function needFacilities(need, facilities) {
  if (!need) return [];
  if (String(need).startsWith('f:')) {
    const def = facilityOf(need.slice(2), facilities);
    return def ? [def] : [{ key: need.slice(2), name: need.slice(2), icon: need.slice(2) }];
  }
  return (facilities ?? []).filter((f) => (f.tags ?? []).includes(need));
}

export function facilityChip(def, { hidden = false } = {}) {
  if (!def) return '';
  return `<span class="fac-chip${hidden ? ' is-hidden' : ''}" title="${hidden ? '' : escapeHTML(def.name)}">${art(def.icon ?? def.key)}${hidden ? '' : `<b>${escapeHTML(def.name)}</b>`}</span>`;
}

export function needChips(need, facilities, { hidden = false, count = 1 } = {}) {
  const list = needFacilities(need, facilities);
  if (!list.length) return `<span class="fac-chip"><b>${escapeHTML(need)}</b></span>`;
  const chips = list.map((f) => facilityChip(f, { hidden })).join(`<i class="fac-or">${hidden ? '·' : '또는'}</i>`);
  return `<span class="fac-group">${chips}${count > 1 ? `<i class="fac-count">×${count}</i>` : ''}</span>`;
}

// 연구실처럼 레벨마다 새로 여는 것 (부품 · 부품 칸)
export function unlockLines(def) {
  const lines = [];
  const parts = def?.unlocks?.parts ?? {};
  for (const [level, list] of Object.entries(parts)) {
    for (const type of list ?? []) {
      const name = VILLAIN.parts.types[type]?.name ?? type;
      lines.push({ level: Number(level), html: `<img class="unlock-part" src="${partIconURL(type, 54)}" alt="">${escapeHTML(name)} 상점에 나와요` });
    }
  }
  for (const [level, n] of Object.entries(def?.unlocks?.partSlots ?? {})) {
    lines.push({ level: Number(level), html: `${lairIcon('plus')}괴수 부품 칸 +${n}` });
  }
  return lines.sort((a, b) => a.level - b.level);
}

export function sheetHead({ icon = '', title = '', sub = '' } = {}) {
  return `
    <header class="lsheet-head">
      <span class="lsheet-grab" data-grab aria-hidden="true"></span>
      ${icon ? `<span class="lsheet-icon">${icon}</span>` : ''}
      <h2 class="lsheet-title">${escapeHTML(title)}${sub ? ` <small data-sub>${escapeHTML(sub)}</small>` : ''}</h2>
      <button type="button" class="vt-btn vt-btn--icon lsheet-close" data-close aria-label="닫기" title="닫기">${lairIcon('close')}</button>
    </header>`;
}

export function priceHTML(value) {
  return coin(value);
}

export function signature(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(Math.random());
  }
}

// 괴수 카드 그림: 괴수 id + 고친 시각 + 부품 수가 같으면 다시 그리지 않음
export function makeThumbs(thumbOf) {
  const cache = new Map();
  return (design) => {
    const key = `${design.id}:${design.updatedAt ?? 0}:${(design.parts ?? []).length}`;
    if (!cache.has(key)) {
      let url = '';
      try {
        url = thumbOf?.(design) || '';
      } catch {
        url = '';
      }
      cache.set(key, url || designThumbURL(design, 160));
    }
    return cache.get(key);
  };
}

export function partIcons(design) {
  return (design.parts ?? [])
    .map((p) => {
      const name = escapeHTML(VILLAIN.parts.types[p.type]?.name ?? p.type);
      return `<img class="mcard-part" src="${partIconURL(p.type, 54)}" alt="${name}" title="${name}">`;
    })
    .join('');
}
