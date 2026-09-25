"""90秒の採用動画用オリジナルBGMを合成する（著作権フリー / 外部素材なし）。

構成は映像のシーンに合わせている:
  0–7s   イントロ（パッドのみ）
  7–28s  海外バイヤー（アルペジオ + キック）
  28–33s ブレイク（やりがいテロップ）
  33–53s 海外営業（ハイハット追加で厚みを出す）
  53–77s 1日の流れ・身につく力（グルーヴ継続）
  77–84s メッセージ（スウェル）
  84–90s CTA（最後のコードを伸ばしてフェードアウト）

使い方: python3 bgm.py  -> out/bgm.wav
"""
import os
import wave

import numpy as np

SR = 44100
DUR = 90.0
BPM = 100
BEAT = 60 / BPM
N = int(SR * DUR)
t_all = np.arange(N) / SR


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# I - V - vi - IV in D major, one chord per bar (4 beats)
CHORDS = [
    [50, 57, 62, 66, 69],  # D
    [45, 57, 61, 64, 69],  # A
    [47, 54, 59, 62, 66],  # Bm
    [43, 55, 59, 62, 67],  # G
]
BAR = BEAT * 4


def section_gain(t, points):
    """points: [(time, gain), ...] -> piecewise-linear envelope"""
    ts, gs = zip(*points)
    return np.interp(t, ts, gs)


def tone(freq, length, harmonics=(1.0, 0.35, 0.15, 0.06), detune=0.0):
    tt = np.arange(int(SR * length)) / SR
    out = np.zeros_like(tt)
    for i, a in enumerate(harmonics, start=1):
        out += a * np.sin(2 * np.pi * freq * i * (1 + detune) * tt)
    return out


out = np.zeros(N)

# ---- pad ----
pad = np.zeros(N)
n_bars = int(np.ceil(DUR / BAR))
for b in range(n_bars):
    start = b * BAR
    chord = CHORDS[b % 4]
    length = BAR + 0.6
    seg = np.zeros(int(SR * length))
    for n in chord[1:]:
        for d in (-0.003, 0.003):
            seg += tone(midi(n), length, harmonics=(1.0, 0.25, 0.08), detune=d)
    tt = np.arange(len(seg)) / SR
    env = np.minimum(1, tt / 0.5) * np.minimum(1, (length - tt) / 0.6)
    seg *= env
    i0 = int(start * SR)
    i1 = min(N, i0 + len(seg))
    pad[i0:i1] += seg[: i1 - i0]
pad *= section_gain(t_all, [(0, 0), (2.5, 0.55), (28, 0.55), (29, 0.8), (33, 0.55), (77, 0.6), (83, 0.9), (86, 0.8), (90, 0)])
out += 0.06 * pad

# ---- bass ----
bass = np.zeros(N)
for b in range(n_bars):
    root = CHORDS[b % 4][0] - 12
    for beat in (0, 2, 2.5):
        st = b * BAR + beat * BEAT
        length = BEAT * (1.8 if beat == 0 else 0.45)
        seg = tone(midi(root), length, harmonics=(1.0, 0.3))
        tt = np.arange(len(seg)) / SR
        seg *= np.exp(-tt * 3) * np.minimum(1, tt / 0.01)
        i0 = int(st * SR)
        i1 = min(N, i0 + len(seg))
        if i0 < N:
            bass[i0:i1] += seg[: i1 - i0]
bass *= section_gain(t_all, [(0, 0), (7, 0), (8, 1), (28, 1), (28.5, 0.2), (33, 1), (84, 1), (86, 0.4), (90, 0)])
out += 0.16 * bass

# ---- arpeggio pluck ----
arp = np.zeros(N)
pattern = [0, 2, 1, 3, 2, 4, 3, 2]
steps = int(DUR / (BEAT / 2))
for s in range(steps):
    st = s * BEAT / 2
    chord = CHORDS[int(st // BAR) % 4]
    note = chord[1:][pattern[s % 8] % 4] + 12
    seg = tone(midi(note), 0.6, harmonics=(1.0, 0.5, 0.25, 0.1, 0.05))
    tt = np.arange(len(seg)) / SR
    seg *= np.exp(-tt * 7) * np.minimum(1, tt / 0.004)
    i0 = int(st * SR)
    i1 = min(N, i0 + len(seg))
    arp[i0:i1] += seg[: i1 - i0]
arp *= section_gain(t_all, [(0, 0), (6.5, 0), (8, 1), (27.5, 1), (28.5, 0), (32.5, 0), (33.5, 1), (77, 1), (78, 0.5), (84, 0.8), (88, 0)])
out += 0.07 * arp

# ---- kick ----
kick = np.zeros(N)
klen = int(SR * 0.35)
kt = np.arange(klen) / SR
kseg = np.sin(2 * np.pi * (50 * kt + 60 * (1 - np.exp(-kt * 30)) / 30)) * np.exp(-kt * 9)
for s in range(int(DUR / BEAT)):
    i0 = int(s * BEAT * SR)
    i1 = min(N, i0 + klen)
    kick[i0:i1] += kseg[: i1 - i0]
kick *= section_gain(t_all, [(0, 0), (12.5, 0), (13, 1), (28, 1), (28.3, 0), (33, 0), (33.2, 1), (77, 1), (77.5, 0), (84, 0), (84.2, 1), (87, 0)])
out += 0.32 * kick

# ---- hi-hat (off-beats) ----
rng = np.random.default_rng(7)
hat = np.zeros(N)
hlen = int(SR * 0.06)
noise = rng.standard_normal(hlen)
noise = np.diff(noise, prepend=0)  # crude high-pass
hseg = noise * np.exp(-np.arange(hlen) / SR * 70)
for s in range(int(DUR / BEAT)):
    i0 = int((s + 0.5) * BEAT * SR)
    i1 = min(N, i0 + hlen)
    if i0 < N:
        hat[i0:i1] += hseg[: i1 - i0]
hat *= section_gain(t_all, [(0, 0), (33, 0), (34, 1), (77, 1), (77.5, 0), (84, 0), (84.2, 0.8), (87, 0)])
out += 0.03 * hat

# ---- riser into the message scene ----
rt0, rt1 = 74.5, 77.6
mask = (t_all >= rt0) & (t_all < rt1)
rt = t_all[mask] - rt0
riser = rng.standard_normal(mask.sum())
riser = np.convolve(riser, np.ones(8) / 8, mode="same")
out[mask] += 0.05 * riser * (rt / (rt1 - rt0)) ** 2

# ---- simple stereo + reverb-ish delay ----
left = out.copy()
right = out.copy()
for delay, g in ((0.19, 0.25), (0.31, 0.18), (0.47, 0.1)):
    d = int(SR * delay)
    left[d:] += g * out[:-d]
    d2 = int(SR * (delay + 0.023))
    right[d2:] += g * out[:-d2]

stereo = np.stack([left, right], axis=1)
# master fade and normalize
fade = section_gain(t_all, [(0, 0), (0.8, 1), (87, 1), (90, 0)])
stereo *= fade[:, None]
stereo /= np.max(np.abs(stereo)) + 1e-9
stereo *= 0.85  # headroom (-1.4 dBFS)

os.makedirs(os.path.join(os.path.dirname(__file__), "out"), exist_ok=True)
path = os.path.join(os.path.dirname(__file__), "out", "bgm.wav")
with wave.open(path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((stereo * 32767).astype(np.int16).tobytes())
print("wrote", path)
