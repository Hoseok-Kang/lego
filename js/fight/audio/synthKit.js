// 소리 재료 (펑펑 토끼 효과음을 만드는 작은 도구들)
// 소리 파일 없이 브라우저(Web Audio)가 직접 만드는 '음'과 '쉬익' 잡음을 겹쳐서 장난감 같은 소리를 냅니다.
// 소리 하나하나의 모양은 fightSoundBank.js, 소리를 켜고 끄는 장치는 fightSounds.js 에 있습니다.
//
//   tone(kit, { type, freq, to, glide, at, attack, hold, decay, volume, vibrato, filter })   음 하나 (freq → to 로 미끄러짐)
//   noise(kit, { at, attack, hold, decay, volume, filter, freq, to, glide, q })              쉬익 잡음 + 필터 (딸깍, 펑, 우르르)
//   melody(kit, [['C5', 시작 초, 길이 초], ...], { type, volume, filter, vibrato })          짧은 노래
//   clatter(kit, { at, count, spread, volume, low, high })                                   블록이 와르르 떨어지는 딸깍딸깍
//   bounce(kit, { at, first, count, volume, freq })                                          블록 하나가 통·통·통 튀다 멈춤
//   note('C5') → 주파수,  pick(목록) → 아무거나 하나
//   createNoiseBuffer(context) / createMasterChain(context, volume)
//
// kit = { ctx, out, noise, t (시작 시각), pitch (높낮이 배수), end, last }

// 음 하나: 오실레이터 + (필터) + 크기 변화
export function tone(kit, { type = 'triangle', freq, to = null, glide = 0.1, at = 0, attack = 0.005, hold = 0, decay = 0.2, volume = 1, vibrato = 0, filter = null }) {
  const { ctx } = kit;
  const t = kit.t + at;
  const end = t + attack + hold + decay + 0.02;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(clampFrequency(freq * kit.pitch, ctx), t);
  if (to) osc.frequency.exponentialRampToValueAtTime(clampFrequency(to * kit.pitch, ctx), t + glide);
  if (vibrato) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(freq * vibrato, t + attack + hold * 0.5 + 0.05);
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(end);
  }
  const amp = ctx.createGain();
  envelope(amp.gain, t, attack, hold, decay, volume);
  connectThroughFilter(kit, osc, amp, filter, t);
  amp.connect(kit.out);
  osc.start(t);
  osc.stop(end);
  track(kit, osc, end);
}

// 쉬익 잡음 + 필터
export function noise(kit, { at = 0, attack = 0.002, hold = 0, decay = 0.1, volume = 1, filter = 'bandpass', freq = 2000, to = null, glide = 0.1, q = 1 }) {
  const { ctx } = kit;
  const t = kit.t + at;
  const end = t + attack + hold + decay + 0.02;
  const source = ctx.createBufferSource();
  source.buffer = kit.noise;
  source.loop = true;
  const amp = ctx.createGain();
  envelope(amp.gain, t, attack, hold, decay, volume);
  connectThroughFilter(kit, source, amp, { type: filter, freq, to, glide, q }, t);
  amp.connect(kit.out);
  source.start(t, Math.random() * (kit.noise.duration * 0.5));
  source.stop(end);
  track(kit, source, end);
}

// 짧은 노래: [['C5', 시작 초, 길이 초], ...]
export function melody(kit, notes, { type = 'triangle', volume = 0.5, filter = null, vibrato = 0 } = {}) {
  for (const [name, at, length] of notes) {
    tone(kit, { type, freq: note(name), at, attack: 0.01, hold: length * 0.7, decay: length * 0.5 + 0.05, volume, filter, vibrato });
  }
}

// 블록 여러 개가 바닥에 와르르: 처음엔 촘촘하고 점점 드문드문, 점점 작게
export function clatter(kit, { at = 0, count = 16, spread = 0.8, volume = 1, low = 1800, high = 4200 }) {
  for (let i = 0; i < count; i++) {
    const k = Math.pow(Math.random(), 1.7);
    const when = at + k * spread;
    const fade = 1 - k * 0.75;
    noise(kit, { at: when, filter: 'bandpass', freq: low + Math.random() * (high - low), q: 6, decay: 0.018 + Math.random() * 0.02, volume: volume * fade });
    if (i % 3 === 0) tone(kit, { type: 'triangle', at: when, freq: 650 + Math.random() * 700, decay: 0.035, volume: 0.22 * volume * fade });
  }
}

// 블록 하나가 통·통·통 튀다 멈춤 (튈 때마다 간격이 짧아지고 작아짐)
export function bounce(kit, { at = 0, first = 0.22, count = 5, volume = 0.8, freq = 3000 }) {
  let when = at;
  let gap = first;
  let loud = volume;
  for (let i = 0; i < count; i++) {
    noise(kit, { at: when, filter: 'bandpass', freq: freq * (1 + i * 0.04), q: 7, decay: 0.022, volume: loud });
    tone(kit, { type: 'triangle', at: when, freq: 900 + i * 40, decay: 0.03, volume: loud * 0.25 });
    when += gap;
    gap *= 0.62;
    loud *= 0.68;
  }
}

function connectThroughFilter(kit, source, target, filter, t) {
  if (!filter || !filter.type) {
    source.connect(target);
    return;
  }
  const node = kit.ctx.createBiquadFilter();
  node.type = filter.type;
  node.Q.value = filter.q ?? 1;
  node.frequency.setValueAtTime(clampFrequency(filter.freq * kit.pitch, kit.ctx), t);
  if (filter.to) node.frequency.exponentialRampToValueAtTime(clampFrequency(filter.to * kit.pitch, kit.ctx), t + (filter.glide ?? 0.1));
  source.connect(node).connect(target);
}

// 소리 크기 변화: 0 → (attack) → volume → (hold 유지) → (decay 동안 사라짐)
function envelope(param, t, attack, hold, decay, volume) {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(volume, t + attack);
  if (hold > 0) param.setValueAtTime(volume, t + attack + hold);
  param.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
}

function track(kit, node, end) {
  if (end >= kit.end) {
    kit.end = end;
    kit.last = node;
  }
}

export function createNoiseBuffer(context) {
  const length = Math.floor(context.sampleRate);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// 전체 크기 → 찢어지는 소리 방지(리미터) → 스피커
export function createMasterChain(context, volume) {
  const master = context.createGain();
  master.gain.value = volume;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  master.connect(limiter).connect(context.destination);
  return master;
}

// 'C5', 'F#4', 'Bb3' 같은 음 이름 → 주파수(Hz)
const NOTE_STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function note(name) {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!match) return 440;
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  const midi = 12 * (Number(match[3]) + 1) + NOTE_STEPS[match[1]] + accidental;
  return 440 * 2 ** ((midi - 69) / 12);
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function clampFrequency(value, context) {
  return Math.min(context.sampleRate / 2 - 100, Math.max(20, value));
}
