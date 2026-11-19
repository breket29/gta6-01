// Synthesised sound only — WebAudio oscillators and noise, no audio files.
export function createAudio() {
  return {
    ctx: null, muted: false, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, sirenLfo: null, musicTimer: null,
    musicStep: 0, started: false,
  };
}

export function initAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audio.ctx = new Ctx();
  // Engine hum: sawtooth through a low-pass, pitch follows speed.
  audio.engineOsc = audio.ctx.createOscillator();
  audio.engineOsc.type = 'sawtooth';
  audio.engineOsc.frequency.value = 55;
  const engineFilter = audio.ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 420;
  audio.engineGain = audio.ctx.createGain();
  audio.engineGain.gain.value = 0;
  audio.engineOsc.connect(engineFilter);
  engineFilter.connect(audio.engineGain);
  audio.engineGain.connect(audio.ctx.destination);
  audio.engineOsc.start();
  // Siren: two-tone square wave, LFO flips the pitch.
  audio.sirenOsc = audio.ctx.createOscillator();
  audio.sirenOsc.type = 'square';
  audio.sirenOsc.frequency.value = 780;
  audio.sirenGain = audio.ctx.createGain();
  audio.sirenGain.gain.value = 0;
  audio.sirenLfo = audio.ctx.createOscillator();
  audio.sirenLfo.type = 'square';
  audio.sirenLfo.frequency.value = 0.9;
  const lfoGain = audio.ctx.createGain();
  lfoGain.gain.value = 180;
  audio.sirenLfo.connect(lfoGain);
  lfoGain.connect(audio.sirenOsc.frequency);
  audio.sirenOsc.connect(audio.sirenGain);
  audio.sirenGain.connect(audio.ctx.destination);
  audio.sirenOsc.start();
  audio.sirenLfo.start();
  startMusic(audio);
}

function startMusic(audio) {
  // Laid-back bass loop in A minor, scheduled a bar at a time.
  const bass = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
  const lead = [220, 0, 261.63, 0, 329.63, 0, 261.63, 0, 196, 0, 220, 0, 246.94, 0, 293.66, 0];
  audio.musicTimer = setInterval(() => {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime + 0.05;
    for (let i = 0; i < 8; i += 1) {
      const step = (audio.musicStep + i) % 16;
      const when = t0 + i * 0.22;
      if (bass[step]) blip(audio, bass[step], when, 0.2, 'triangle', 0.10);
      if (i % 2 === 0 && lead[step]) blip(audio, lead[step], when, 0.18, 'sine', 0.045);
    }
    audio.musicStep = (audio.musicStep + 8) % 16;
  }, 8 * 0.22 * 1000);
}

function blip(audio, freq, when, dur, type, vol) {
  const o = audio.ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = audio.ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, when + dur);
  o.connect(g);
  g.connect(audio.ctx.destination);
  o.start(when);
  o.stop(when + dur + 0.05);
}

export function setEngine(audio, speedNorm, inCar) {
  if (!audio.ctx) return;
  const target = audio.muted ? 0 : inCar ? 0.03 + speedNorm * 0.05 : 0;
  audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
  audio.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 130, audio.ctx.currentTime, 0.1);
}

export function setSiren(audio, on) {
  if (!audio.ctx) return;
  audio.sirenGain.gain.setTargetAtTime(audio.muted || !on ? 0 : 0.028, audio.ctx.currentTime, 0.2);
}

function noiseBurst(audio, dur, vol, freq) {
  if (!audio.ctx || audio.muted) return;
  const len = Math.floor(audio.ctx.sampleRate * dur);
  const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.ctx.createBufferSource();
  src.buffer = buf;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const g = audio.ctx.createGain();
  g.gain.value = vol;
  src.connect(filter);
  filter.connect(g);
  g.connect(audio.ctx.destination);
  src.start();
}

export function playShoot(audio) { noiseBurst(audio, 0.14, 0.5, 1800); }
export function playPunch(audio) { noiseBurst(audio, 0.09, 0.35, 500); }
export function playCrash(audio) { noiseBurst(audio, 0.25, 0.4, 300); }
export function playPickup(audio) {
  if (!audio.ctx || audio.muted) return;
  blip(audio, 880, audio.ctx.currentTime, 0.12, 'sine', 0.14);
  blip(audio, 1318.5, audio.ctx.currentTime + 0.09, 0.16, 'sine', 0.14);
}
export function playMissionDone(audio) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(audio, f, t + i * 0.11, 0.22, 'triangle', 0.14));
}
export function playBusted(audio) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  [392, 311.13, 261.63].forEach((f, i) => blip(audio, f, t + i * 0.16, 0.25, 'sawtooth', 0.08));
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (!audio.ctx) return;
  if (muted) {
    audio.engineGain.gain.value = 0;
    audio.sirenGain.gain.value = 0;
  }
}
