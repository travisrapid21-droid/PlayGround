export function createAudioEngine() {
  let context = null;
  let master = null;
  let engineGain = null;
  let windGain = null;
  let whineGain = null;
  let lowOsc = null;
  let highOsc = null;
  let noiseSource = null;
  let started = false;
  let muted = false;

  function makeNoiseBuffer(ctx) {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.86 + white * 0.14;
      data[i] = last * 0.62 + white * 0.18;
    }
    return buffer;
  }

  function start() {
    if (started) {
      if (context?.state === 'suspended') context.resume();
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      context = new AudioCtx();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.23;
      master.connect(context.destination);

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -22;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.24;
      compressor.connect(master);

      lowOsc = context.createOscillator();
      lowOsc.type = 'sawtooth';
      lowOsc.frequency.value = 43;
      const lowFilter = context.createBiquadFilter();
      lowFilter.type = 'lowpass';
      lowFilter.frequency.value = 250;
      lowFilter.Q.value = 0.9;
      engineGain = context.createGain();
      engineGain.gain.value = 0.12;
      lowOsc.connect(lowFilter).connect(engineGain).connect(compressor);
      lowOsc.start();

      highOsc = context.createOscillator();
      highOsc.type = 'triangle';
      highOsc.frequency.value = 118;
      whineGain = context.createGain();
      whineGain.gain.value = 0.018;
      highOsc.connect(whineGain).connect(compressor);
      highOsc.start();

      noiseSource = context.createBufferSource();
      noiseSource.buffer = makeNoiseBuffer(context);
      noiseSource.loop = true;
      const noiseFilter = context.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 520;
      noiseFilter.Q.value = 0.6;
      windGain = context.createGain();
      windGain.gain.value = 0.028;
      noiseSource.connect(noiseFilter).connect(windGain).connect(compressor);
      noiseSource.start();

      started = true;
    } catch (error) {
      console.warn('Audio unavailable', error);
    }
  }

  function update(throttle, speed, gLoad) {
    if (!started || !context) return;
    const now = context.currentTime;
    const thrust = Math.max(0, Math.min(1, throttle));
    const speedFactor = Math.max(0, Math.min(1.5, speed / 300));
    lowOsc.frequency.setTargetAtTime(38 + thrust * 41 + speedFactor * 8, now, 0.11);
    highOsc.frequency.setTargetAtTime(102 + thrust * 145 + speedFactor * 40, now, 0.17);
    engineGain.gain.setTargetAtTime(0.075 + thrust * 0.16, now, 0.16);
    whineGain.gain.setTargetAtTime(0.009 + thrust * 0.032, now, 0.18);
    windGain.gain.setTargetAtTime(0.012 + speedFactor * 0.085 + Math.max(0, gLoad - 2) * 0.009, now, 0.2);
  }

  function setMuted(value) {
    muted = value;
    if (master && context) master.gain.setTargetAtTime(muted ? 0 : 0.23, context.currentTime, 0.04);
  }

  function toggleMuted() {
    setMuted(!muted);
    return muted;
  }

  function isMuted() {
    return muted;
  }

  return { start, update, setMuted, toggleMuted, isMuted };
}
