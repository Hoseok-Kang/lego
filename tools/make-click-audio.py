# 영상 만들기 2단계: events.json을 보고 '딸깍' 소리와 완성 멜로디를 WAV 파일로 만듭니다.
# 사용법: python3 tools/make-click-audio.py <출력폴더>/events.json <출력폴더>/audio.wav
# 3단계(영상 합치기):
#   ffmpeg -framerate 30 -i <출력폴더>/frames/f%05d.png -i <출력폴더>/audio.wav \
#          -c:v libx264 -crf 20 -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart 영상.mp4
import json, sys, wave
import numpy as np
ev = json.load(open(sys.argv[1]))
fps, frames = ev['fps'], ev['frames']
sr = 44100
total = int(frames / fps * sr) + sr
buf = np.zeros(total, dtype=np.float64)
rng = np.random.default_rng(3)

def click():
    n = int(0.06 * sr); t = np.arange(n) / sr
    f1 = rng.uniform(2500, 3800); f2 = rng.uniform(700, 1100)
    s = 0.55 * np.sin(2*np.pi*f1*t) * np.exp(-t/0.006)
    s += 0.45 * np.sin(2*np.pi*f2*t) * np.exp(-t/0.018)
    s += 0.18 * rng.uniform(-1, 1, n) * np.exp(-t/0.004)
    return s * rng.uniform(0.55, 1.0)

def tri(freq, n):
    t = np.arange(n) / sr
    return 2*np.abs(2*((t*freq) % 1) - 1) - 1

def fanfare():
    notes = [523.25, 659.25, 783.99, 1046.5]
    out = np.zeros(int(1.4 * sr))
    for i, f in enumerate(notes):
        start = int(i * 0.11 * sr)
        dur = 0.9 if i == len(notes) - 1 else 0.3
        n = int(dur * sr); t = np.arange(n) / sr
        env = np.minimum(1, t / 0.015) * np.exp(-t / (0.35 if i == len(notes) - 1 else 0.1))
        out[start:start+n] += 0.5 * tri(f, n) * env
    return out

for frame, kind in ev['events']:
    pos = int(frame / fps * sr)
    s = click() * 0.5 if kind == 'click' else fanfare() * 0.6
    end = min(total, pos + len(s))
    buf[pos:end] += s[:end-pos]

buf = buf[: int(frames / fps * sr)]
peak = np.max(np.abs(buf)) or 1
buf = buf / peak * 0.85
pcm = (buf * 32767).astype(np.int16)
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())
print('wav seconds', len(pcm)/sr)
