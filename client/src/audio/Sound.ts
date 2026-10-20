/**
 * Procedural Web Audio API sound synthesizer for the Creature Arena Battler.
 * Zero external audio files required!
 */

import { type TypeId } from "@game/shared";

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

const MASTER_VOL = 0.8;
const MUTE_KEY = "arena-battler-muted";

class SoundBox {
  muted = false;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private amb: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wantAmb = false;

  constructor() {
    if (typeof window === "undefined") return;
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      /* storage blocked */
    }
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_VOL;
      this.master.connect(this.ctx.destination);

      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.wantAmb) this.startAmb();
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : MASTER_VOL, this.ctx.currentTime, 0.02);
    }
  }

  private tone(freq: number, end: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
    if (!this.ctx || !this.master) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (end !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(1, end), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(
    dur: number,
    vol: number,
    type: BiquadFilterType,
    f0: number,
    f1: number,
    delay = 0,
    attack = 0.004
  ) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  whistle(dur = 0.4, delay = 0) {
    if (!this.ctx || !this.master) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    const lfo = c.createOscillator();
    const lg = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(2700, t);
    o.frequency.linearRampToValueAtTime(2900, t + dur);
    lfo.frequency.value = 38;
    lg.gain.value = 0.08;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.setValueAtTime(0.18, t + Math.max(0.03, dur - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lfo.connect(lg);
    lg.connect(g.gain);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.02);
    lfo.stop(t + dur + 0.02);
  }

  jump() {
    this.tone(260, 520, 0.1, "square", 0.06);
  }

  tick() {
    this.tone(660, 660, 0.1, "square", 0.07);
  }

  go() {
    this.whistle(0.35);
    this.tone(880, 880, 0.2, "square", 0.06);
  }

  cast(type: TypeId) {
    switch (type) {
      case "ember":
        this.noise(0.15, 0.35, "bandpass", 1600, 400);
        this.tone(240, 90, 0.18, "sawtooth", 0.15);
        break;
      case "tide":
        this.noise(0.2, 0.4, "lowpass", 900, 250);
        this.tone(320, 180, 0.2, "sine", 0.2);
        break;
      case "gale":
        this.noise(0.12, 0.3, "highpass", 2200, 3800);
        this.tone(550, 880, 0.14, "triangle", 0.15);
        break;
      case "stone":
        this.noise(0.18, 0.5, "lowpass", 400, 100);
        this.tone(90, 40, 0.2, "sine", 0.35);
        break;
      case "volt":
        this.tone(800, 1400, 0.12, "sawtooth", 0.22);
        this.noise(0.08, 0.25, "bandpass", 3000, 4500);
        break;
      case "bloom":
        this.noise(0.14, 0.3, "bandpass", 1200, 600);
        this.tone(380, 220, 0.16, "triangle", 0.18);
        break;
    }
  }

  hit(multiplier = 1.0) {
    const isSuper = multiplier > 1.2;
    if (isSuper) {
      // Critical super-effective smash!
      this.noise(0.16, 0.65, "lowpass", 2200, 300);
      this.tone(480, 80, 0.22, "sawtooth", 0.45);
      this.tone(720, 300, 0.16, "triangle", 0.3);
    } else {
      // Normal / Resisted hit
      this.noise(0.1, 0.4, "lowpass", 1400, 300);
      this.tone(220, 60, 0.14, "sine", 0.35);
    }
  }

  ko() {
    this.whistle(0.2);
    this.whistle(0.2, 0.25);
    this.whistle(0.6, 0.5);
    this.noise(1.8, 0.5, "lowpass", 1200, 150, 0.3);
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.95, 0.32, "triangle", 0.2, 0.8 + i * 0.22));
  }

  roundWin() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.18, "square", 0.08, i * 0.09));
  }

  taunt() {
    // Playful 3-tone troll chuckle
    [587, 880, 1175].forEach((f, i) =>
      this.tone(f, f * 1.04, 0.08, "sine", 0.14, i * 0.07)
    );
  }

  matchWin() {
    this.whistle(0.18);
    this.whistle(0.18, 0.25);
    this.whistle(0.5, 0.5);
    this.noise(2.2, 0.45, "bandpass", 700, 1200, 0.4, 0.4);
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      this.tone(f, f, 0.22, "triangle", 0.14, 0.6 + i * 0.12)
    );
  }

  ambience(on: boolean) {
    this.wantAmb = on;
    if (on) this.startAmb();
    else this.stopAmb();
  }

  private startAmb() {
    if (this.amb || !this.ctx || !this.noiseBuf) return;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 420;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 1);
    s.connect(f);
    f.connect(g);
    if (this.master) g.connect(this.master);
    s.start();
    this.amb = { src: s, gain: g };
  }

  private stopAmb() {
    if (!this.amb || !this.ctx) return;
    const { src, gain } = this.amb;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    src.stop(t + 0.45);
    this.amb = null;
  }
}

export const sound = new SoundBox();
