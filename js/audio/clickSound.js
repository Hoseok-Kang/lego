// 소리
// 블록이 앉을 때 '딸깍', 다 쌓으면 짧은 '완성' 멜로디를 냅니다.
// 소리 파일 없이 브라우저가 직접 소리를 만들어 냅니다.
// 브라우저 규칙상 사용자가 버튼을 한 번 눌러야 소리가 납니다.

export function createClickSound({ minGapMs = 40, volume = 0.22 } = {}) {
  let audio = null;
  let noise = null;
  let enabled = false;
  let lastClickAt = 0;

  function ensureAudio() {
    if (!audio) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      audio = new AudioContextClass();
      noise = createNoiseBuffer(audio);
    }
    if (audio.state === 'suspended') audio.resume();
    return true;
  }

  function setEnabled(on) {
    enabled = on && ensureAudio();
    return enabled;
  }

  function playClick() {
    if (!enabled) return;
    const now = performance.now();
    if (now - lastClickAt < minGapMs) return;
    lastClickAt = now;

    const t = audio.currentTime;
    const source = audio.createBufferSource();
    source.buffer = noise;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2200 + Math.random() * 1600;
    filter.Q.value = 5;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start(t);
    source.stop(t + 0.06);
  }

  function playFanfare() {
    if (!enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // 도 미 솔 도
    notes.forEach((frequency, i) => {
      const t = audio.currentTime + i * 0.11;
      const osc = audio.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = frequency;
      const gain = audio.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume * 0.9, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (i === notes.length - 1 ? 0.6 : 0.25));
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + 0.7);
    });
  }

  return { setEnabled, isEnabled: () => enabled, playClick, playFanfare };
}

function createNoiseBuffer(audio) {
  const length = Math.floor(audio.sampleRate * 0.06);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  return buffer;
}
