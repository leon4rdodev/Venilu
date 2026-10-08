/**
 * Web Audio API sound utilities for POS
 * Generates synthesized sounds programmatically - no external files needed
 */

// Audio context singleton (lazy initialized on first user interaction)
let audioContext: AudioContext | null = null;

/** Initialize audio context (must be called after user gesture) */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (browser policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

/** Play a synthesized tone */
function playTone(
  frequency: number | number[],
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.5,
  options?: { attack?: number; decay?: number; sustain?: number; release?: number; freq2?: number }
) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const frequencies = Array.isArray(frequency) ? frequency : [frequency];

    frequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.value = freq;

      // ADSR envelope
      const attack = options?.attack ?? 0.01;
      const decay = options?.decay ?? 0.05;
      const sustain = options?.sustain ?? 0.3;
      const release = options?.release ?? duration - attack - decay;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + attack);
      gain.gain.linearRampToValueAtTime(volume * sustain, now + attack + decay);
      gain.gain.linearRampToValueAtTime(0, now + attack + decay + release);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + attack + decay + release);
    });
  } catch (error) {
    // Fail silently - sound is non-critical
    console.debug('Sound playback failed:', error);
  }
}

/** Play a chord (multiple frequencies simultaneously) */
function playChord(frequencies: number[], duration: number, volume: number = 0.3, type: OscillatorType = 'sine') {
  playTone(frequencies, duration, type, volume);
}

/** Sound definitions */
export const POSSounds = {
  /** Short, pleasant "pop" when adding item to cart */
  addProduct: (volume: number = 0.5) => {
    // C6 (1046.50 Hz) - bright, positive confirmation
    playTone(1046.50, 0.15, 'sine', volume * 0.6, { attack: 0.005, decay: 0.05, sustain: 0.1, release: 0.095 });
  },

  /** Success chord when sale completes */
  saleComplete: (volume: number = 0.5) => {
    // Major chord: C5 + E5 + G5 (523.25 + 659.25 + 783.99)
    // Play as arpeggio for more pleasant feel
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const baseVolume = volume * 0.4;

    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const delay = i * 0.08; // Stagger for arpeggio effect
      const dur = 0.4;

      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(baseVolume, now + delay + 0.02);
      gain.gain.linearRampToValueAtTime(baseVolume * 0.3, now + delay + 0.1);
      gain.gain.linearRampToValueAtTime(0, now + delay + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + dur);
    });
  },

  /** Error/alert sound */
  error: (volume: number = 0.5) => {
    // Two-tone descending (like a "wrong" buzzer)
    playTone([523.25, 415.30], 0.3, 'square', volume * 0.5, { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.19 });
  },

  /** Cash register "cha-ching" */
  cashRegister: (volume: number = 0.5) => {
    // Classic cash register sound: two quick metallic tones
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const baseVolume = volume * 0.5;

    // First "cha"
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.value = 880; // A5
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(baseVolume, now + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second "ching"
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.value = 1320; // E6
    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(baseVolume, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.25);
  },

  /** Scan/barcode beep */
  scan: (volume: number = 0.5) => {
    // Short high beep
    playTone(1568, 0.08, 'sine', volume * 0.5, { attack: 0.001, decay: 0.02, sustain: 0.05, release: 0.009 });
  },
};

/** Initialize audio context on first user interaction */
export function initAudioContext() {
  getAudioContext();
}

/** Play sound if enabled in settings */
export function playSound(
  soundFn: (volume: number) => void,
  settings: {
    sound_enabled?: boolean;
    sound_volume?: number;
    sound_add_product?: boolean;
    sound_sale_complete?: boolean;
  } | null,
  type: 'addProduct' | 'saleComplete'
) {
  if (!settings?.sound_enabled) return;

  const globalVolume = settings.sound_volume ?? 0.5;

  if (type === 'addProduct' && settings.sound_add_product) {
    soundFn(globalVolume);
  } else if (type === 'saleComplete' && settings.sound_sale_complete) {
    soundFn(globalVolume);
  }
}