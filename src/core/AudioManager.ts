import { GameSettings, PickupType } from './Types';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  private masterVolume: number = 0.8;
  private sfxVolume: number = 0.8;
  private ambientVolume: number = 0.6;

  // Ambience nodes
  private windOsc: AudioBufferSourceNode | null = null;
  private ambientRunning: boolean = false;

  constructor() {}

  public init(settings: GameSettings): void {
    this.masterVolume = settings.masterVolume;
    this.sfxVolume = settings.sfxVolume;
    this.ambientVolume = settings.ambientVolume ?? 0.6;
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.ambientGain = this.ctx.createGain();

        this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
        this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
        this.ambientGain.gain.setValueAtTime(this.ambientVolume, this.ctx.currentTime);

        this.sfxGain.connect(this.masterGain);
        this.ambientGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.startAmbience();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setVolumes(master: number, sfx: number, ambient: number): void {
    this.masterVolume = Math.max(0, Math.min(1, master));
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    this.ambientVolume = Math.max(0, Math.min(1, ambient));

    if (this.ctx && this.masterGain && this.sfxGain && this.ambientGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.masterVolume, now, 0.05);
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, now, 0.05);
      this.ambientGain.gain.setTargetAtTime(this.ambientVolume, now, 0.05);
    }
  }

  // 1. Environmental Ambience (Howling Wind & Post-Apocalyptic Drone)
  private startAmbience(): void {
    if (this.ambientRunning || !this.ctx || !this.ambientGain) return;
    this.ambientRunning = true;

    // Generate seamless looping wind noise buffer (4 seconds)
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + white * 0.05;
      b1 = 0.96 * b1 + white * 0.1;
      b2 = 0.85 * b2 + white * 0.2;
      data[i] = (b0 + b1 + b2) * 0.4;
    }

    const windSource = this.ctx.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;

    // Wind filter with subtle modulation
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    windFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    // LFO for slow wind gusts
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.18, this.ctx.currentTime);
    lfoGain.gain.setValueAtTime(140, this.ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.35, this.ctx.currentTime);

    windSource.connect(windFilter);
    windFilter.connect(gainNode);
    gainNode.connect(this.ambientGain);

    windSource.start();
    lfo.start();
    this.windOsc = windSource;
  }

  // 2. Weapons & Gunplay
  public playGunshot(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Transient crack noise burst
    const bufLen = ctx.sampleRate * 0.14;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2600, now);
    noiseFilter.Q.setValueAtTime(1.5, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1.1, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + 0.15);

    // Punchy sub-bass explosion
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.type = 'triangle';
    bass.frequency.setValueAtTime(210, now);
    bass.frequency.exponentialRampToValueAtTime(32, now + 0.18);

    bassGain.gain.setValueAtTime(1.2, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    bass.connect(bassGain);
    bassGain.connect(this.sfxGain);

    bass.start(now);
    bass.stop(now + 0.26);

    // Metallic slide blowback snap
    const metal = ctx.createOscillator();
    const metalGain = ctx.createGain();
    metal.type = 'sawtooth';
    metal.frequency.setValueAtTime(1200, now + 0.04);
    metal.frequency.exponentialRampToValueAtTime(350, now + 0.09);

    metalGain.gain.setValueAtTime(0.35, now + 0.04);
    metalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    metal.connect(metalGain);
    metalGain.connect(this.sfxGain);

    metal.start(now + 0.04);
    metal.stop(now + 0.11);
  }

  public playShellCasing(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // High metallic ping bouncing on concrete
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3400 + Math.random() * 400, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.04);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.06);

    // Secondary bounce
    setTimeout(() => {
      if (!this.ctx || !this.sfxGain) return;
      const t = this.ctx.currentTime;
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2800, t);
      osc2.frequency.exponentialRampToValueAtTime(1400, t + 0.03);

      gain2.gain.setValueAtTime(0.1, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

      osc2.connect(gain2);
      gain2.connect(this.sfxGain);
      osc2.start(t);
      osc2.stop(t + 0.04);
    }, 90);
  }

  public playEmptyClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.035);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playReload(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // 1. Mag release click (t=0)
    this.playTone(now, 1500, 0.05, 0.35, 'triangle');
    // 2. Mag insert tactile slide (t=0.85s)
    this.playTone(now + 0.85, 950, 0.08, 0.45, 'triangle');
    this.playTone(now + 0.95, 1750, 0.06, 0.5, 'square');
    // 3. Slide rack pull & snap (t=1.6s)
    this.playTone(now + 1.55, 1300, 0.07, 0.45, 'sawtooth');
    this.playTone(now + 1.75, 2600, 0.09, 0.65, 'sawtooth');
  }

  public playWeaponSwitch(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    this.playTone(ctx.currentTime, 1800, 0.06, 0.35, 'triangle');
  }

  public playMeleeSwing(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Fast whoosh
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.16);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playMeleeImpact(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Wet flesh slash + thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);

    gain.gain.setValueAtTime(0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playGrenadeExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // 1. Massive noise blast
    const bufLen = ctx.sampleRate * 0.8;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.18));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.8);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + 0.85);

    // 2. Earthquake Sub-Bass Thump
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(24, now + 0.7);

    subGain.gain.setValueAtTime(1.6, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    sub.connect(subGain);
    subGain.connect(this.sfxGain);

    sub.start(now);
    sub.stop(now + 0.8);
  }

  // 3. Player Movement Sounds
  public playFootstep(isSprinting: boolean = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const freq = isSprinting ? 95 : 75;
    osc.frequency.setValueAtTime(freq + Math.random() * 15, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

    gain.gain.setValueAtTime(isSprinting ? 0.35 : 0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playJump(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    this.playTone(ctx.currentTime, 160, 0.14, 0.3, 'sine');
  }

  public playLanding(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.15);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playPlayerHurt(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.22);

    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  public playFlashlightToggle(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    this.playTone(ctx.currentTime, 1900, 0.03, 0.35, 'square');
  }

  public playInteract(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playTone(now, 480, 0.08, 0.4, 'triangle');
    this.playTone(now + 0.06, 720, 0.1, 0.4, 'triangle');
  }

  public playDoorCreak(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(320, now + 0.3);
    osc.frequency.linearRampToValueAtTime(140, now + 0.6);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  // 4. Hitmarker & Combat Feedback
  public playHitmarker(headshot: boolean = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const freq = headshot ? 2600 : 1750;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.setValueAtTime(freq * 1.25, now + 0.03);

    gain.gain.setValueAtTime(headshot ? 0.7 : 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (headshot ? 0.1 : 0.06));

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playFleshImpact(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.09);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playWallHit(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.06);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // 5. Zombie Vocals with Spatial Distance Volume
  public playZombieGrowl(pitchScale: number = 1.0, distance: number = 10): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Attenuate volume over distance (max 35m)
    const distFactor = Math.max(0.05, Math.min(1.0, 1 - distance / 35));

    const osc = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95 * pitchScale, now);
    osc.frequency.linearRampToValueAtTime(68 * pitchScale, now + 0.6);

    mod.type = 'sine';
    mod.frequency.setValueAtTime(32, now);
    modGain.gain.setValueAtTime(50, now);

    mod.connect(modGain);
    modGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.35 * distFactor, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    mod.start(now);
    osc.start(now);
    mod.stop(now + 0.7);
    osc.stop(now + 0.7);
  }

  public playZombieAttack(pitchScale: number = 1.0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190 * pitchScale, now);
    osc.frequency.exponentialRampToValueAtTime(55 * pitchScale, now + 0.38);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  public playZombieDeath(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.65);

    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.75);
  }

  // 6. Pickups & Rewards
  public playPickup(type: PickupType): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    if (type === PickupType.HEALTH) {
      this.playTone(now, 523.25, 0.15, 0.4, 'sine');
      this.playTone(now + 0.08, 783.99, 0.25, 0.45, 'sine');
    } else if (type === PickupType.AMMO) {
      this.playTone(now, 1174.66, 0.08, 0.35, 'triangle');
      this.playTone(now + 0.07, 1760.00, 0.12, 0.4, 'triangle');
    } else if (type === PickupType.GRENADE) {
      this.playTone(now, 440, 0.1, 0.4, 'sawtooth');
      this.playTone(now + 0.08, 660, 0.15, 0.45, 'triangle');
    } else {
      this.playTone(now, 987.77, 0.1, 0.4, 'sine');
      this.playTone(now + 0.08, 1318.51, 0.22, 0.5, 'sine');
    }
  }

  public playWaveHorn(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(108, now);
    osc.frequency.linearRampToValueAtTime(102, now + 1.4);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(550, now);
    filter.frequency.linearRampToValueAtTime(1500, now + 0.6);
    filter.frequency.linearRampToValueAtTime(450, now + 1.5);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.65, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 1.65);
  }

  public playLevelWin(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      this.playTone(now + idx * 0.12, freq, 0.35, 0.4, 'sine');
    });
  }

  public playGameOver(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const notes = [392.00, 369.99, 329.63, 277.18];
    notes.forEach((freq, idx) => {
      this.playTone(now + idx * 0.2, freq, 0.5, 0.45, 'sawtooth');
    });
  }

  private playTone(time: number, freq: number, duration: number, vol: number, type: OscillatorType = 'sine'): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(time);
    osc.stop(time + duration);
  }
}
