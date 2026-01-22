import { Injectable } from '@angular/core';

export interface HighScore {
  id: number;
  player_name: string;
  score: number;
  level: number;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base =
    (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process?.env?.['NG_APP_API_BASE']) ||
    (globalThis as any)['NG_APP_API_BASE'] ||
    '/api';

  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  // PUBLIC_INTERFACE
  public async health(): Promise<{ message: string }> {
    /** Check backend health endpoint. */
    if (!this.isBrowser()) return { message: 'SSR' };
    const res = await fetch(`${this.base}/health/`);
    if (!res.ok) throw new Error(`Health failed: ${res.status}`);
    return (await res.json()) as { message: string };
  }

  // PUBLIC_INTERFACE
  public async listHighScores(): Promise<HighScore[]> {
    /** Fetch top high scores. */
    if (!this.isBrowser()) return [];
    const res = await fetch(`${this.base}/highscores/`);
    if (!res.ok) throw new Error(`List highscores failed: ${res.status}`);
    return (await res.json()) as HighScore[];
  }

  // PUBLIC_INTERFACE
  public async submitHighScore(payload: { player_name: string; score: number; level: number }): Promise<HighScore> {
    /** Submit a new high score. */
    if (!this.isBrowser()) {
      return {
        id: -1,
        player_name: payload.player_name,
        score: payload.score,
        level: payload.level,
        created_at: new Date().toISOString(),
      };
    }
    const res = await fetch(`${this.base}/highscores/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Submit highscore failed: ${res.status}`);
    return (await res.json()) as HighScore;
  }
}
