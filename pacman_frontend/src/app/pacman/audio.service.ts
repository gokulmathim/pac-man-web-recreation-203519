import { Injectable } from '@angular/core';

type SoundName = 'dot' | 'pellet' | 'eat-ghost' | 'die' | 'level';

@Injectable({ providedIn: 'root' })
export class AudioService {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  // PUBLIC_INTERFACE
  public setEnabled(enabled: boolean): void {
    /** Enable/disable sounds globally. */
    this.enabled = enabled;
  }

  // PUBLIC_INTERFACE
  public async ensureStarted(): Promise<void> {
    /** Ensure AudioContext exists and is resumed (must be called from a user gesture in some browsers). */
    if (!this.enabled) return;
    if (!this.isBrowser()) return;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  // PUBLIC_INTERFACE
  public play(name: SoundName): void {
    /** Play a simple synthesized sound effect. */
    if (!this.enabled) return;
    if (!this.isBrowser()) return;
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = name === 'die' ? 'sawtooth' : 'square';

    const { f0, f1, dur, g0 } = this.getParams(name);

    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.exponentialRampToValueAtTime(f1, now + dur);

    gain.gain.setValueAtTime(g0, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + dur);
  }

  private getParams(name: SoundName): { f0: number; f1: number; dur: number; g0: number } {
    switch (name) {
      case 'dot':
        return { f0: 520, f1: 420, dur: 0.06, g0: 0.06 };
      case 'pellet':
        return { f0: 220, f1: 520, dur: 0.18, g0: 0.08 };
      case 'eat-ghost':
        return { f0: 660, f1: 990, dur: 0.14, g0: 0.08 };
      case 'level':
        return { f0: 330, f1: 660, dur: 0.22, g0: 0.08 };
      case 'die':
        return { f0: 440, f1: 110, dur: 0.35, g0: 0.10 };
      default:
        return { f0: 440, f1: 440, dur: 0.1, g0: 0.05 };
    }
  }
}
