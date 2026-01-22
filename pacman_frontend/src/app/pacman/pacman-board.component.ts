import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { createDefaultMaze } from './maze';
import { PacmanEngine } from './game-engine';
import type { Direction, Tile } from './types';
import { AudioService } from './audio.service';
import { ApiService, HighScore } from '../services/api.service';

@Component({
  selector: 'app-pacman-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pacman-board.component.html',
  styleUrl: './pacman-board.component.css',
})
export class PacmanBoardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  protected engine = new PacmanEngine(createDefaultMaze());
  protected highscores: HighScore[] = [];
  protected backendStatus: 'unknown' | 'ok' | 'down' = 'unknown';

  protected soundEnabled = true;

  private rafId: number | null = null;
  private tickTimer: number | null = null;

  private readonly tileSize = 24;

  protected playerName = 'Player';

  constructor(
    private audio: AudioService,
    private api: ApiService,
  ) {}

  async ngAfterViewInit(): Promise<void> {
    this.resizeCanvasToMaze();
    this.startLoop();

    try {
      await this.api.health();
      this.backendStatus = 'ok';
      this.highscores = await this.api.listHighScores();
    } catch {
      this.backendStatus = 'down';
    }
  }

  ngOnDestroy(): void {
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    if (this.tickTimer != null) window.clearInterval(this.tickTimer);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.resizeCanvasToMaze();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    const dir: Direction | null =
      key === 'arrowup' || key === 'w'
        ? 'up'
        : key === 'arrowdown' || key === 's'
          ? 'down'
          : key === 'arrowleft' || key === 'a'
            ? 'left'
            : key === 'arrowright' || key === 'd'
              ? 'right'
              : null;

    if (dir) {
      e.preventDefault();
      this.engine.setNextDirection(dir);
      return;
    }

    if (key === 'p') {
      e.preventDefault();
      this.engine.togglePause();
    }

    if (key === 'r') {
      e.preventDefault();
      this.resetGame();
    }
  }

  protected async toggleSound(): Promise<void> {
    this.soundEnabled = !this.soundEnabled;
    this.audio.setEnabled(this.soundEnabled);
    if (this.soundEnabled) await this.audio.ensureStarted();
  }

  protected async onStartClick(): Promise<void> {
    await this.audio.ensureStarted();
    this.engine.setPaused(false);
  }

  protected resetGame(): void {
    this.engine = new PacmanEngine(createDefaultMaze());
    this.resizeCanvasToMaze();
  }

  protected async submitScoreIfGameOver(): Promise<void> {
    const snap = this.engine.getSnapshot();
    if (!snap.isGameOver) return;
    if (this.backendStatus !== 'ok') return;

    const name = (this.playerName || 'Player').slice(0, 24);
    try {
      await this.api.submitHighScore({ player_name: name, score: snap.score, level: snap.level });
      this.highscores = await this.api.listHighScores();
    } catch {
      // ignore
    }
  }

  private startLoop(): void {
    this.tickTimer = window.setInterval(() => {
      const { events } = this.engine.tick();
      for (const ev of events) {
        if (ev === 'dot') this.audio.play('dot');
        if (ev === 'pellet') this.audio.play('pellet');
        if (ev === 'eat-ghost') this.audio.play('eat-ghost');
        if (ev === 'die') this.audio.play('die');
        if (ev === 'level') this.audio.play('level');
      }
      void this.submitScoreIfGameOver();
    }, 100);

    const render = () => {
      this.draw();
      this.rafId = requestAnimationFrame(render);
    };
    render();
  }

  private resizeCanvasToMaze(): void {
    const canvas = this.canvasRef.nativeElement;
    const snap = this.engine.getSnapshot();
    canvas.width = snap.width * this.tileSize;
    canvas.height = snap.height * this.tileSize;
  }

  private draw(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const snap = this.engine.getSnapshot();
    const tiles = this.engine.getMazeTiles();

    ctx.fillStyle = '#0B1020';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < snap.height; y++) {
      for (let x = 0; x < snap.width; x++) {
        const t = tiles[y]![x]!;
        this.drawTile(ctx, x, y, t);
      }
    }

    this.drawPacman(ctx, snap.pacman.pos.x, snap.pacman.pos.y);

    for (const g of snap.ghosts) {
      this.drawGhost(ctx, g.pos.x, g.pos.y, g.color, g.mode === 'frightened' && g.frightenedTicks > 0);
    }

    if (snap.isPaused || snap.isGameOver || snap.message) {
      const text = snap.isGameOver ? 'GAME OVER' : snap.isPaused ? 'PAUSED' : snap.message ?? '';
      if (text) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, canvas.height / 2 - 36, canvas.width, 72);
        ctx.fillStyle = '#F9FAFB';
        ctx.font = 'bold 28px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 10);
        ctx.textAlign = 'start';
      }
    }
  }

  private drawTile(ctx: CanvasRenderingContext2D, x: number, y: number, t: Tile): void {
    const px = x * this.tileSize;
    const py = y * this.tileSize;

    if (t === 'wall') {
      ctx.fillStyle = '#1E3A8A';
      ctx.fillRect(px, py, this.tileSize, this.tileSize);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.strokeRect(px + 0.5, py + 0.5, this.tileSize - 1, this.tileSize - 1);
      return;
    }

    ctx.fillStyle = '#0B1020';
    ctx.fillRect(px, py, this.tileSize, this.tileSize);

    if (t === 'dot') {
      ctx.fillStyle = '#E5E7EB';
      ctx.beginPath();
      ctx.arc(px + this.tileSize / 2, py + this.tileSize / 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (t === 'pellet') {
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(px + this.tileSize / 2, py + this.tileSize / 2, 5.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (t === 'gate') {
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + 2, py + this.tileSize / 2);
      ctx.lineTo(px + this.tileSize - 2, py + this.tileSize / 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    } else if (t === 'tunnel') {
      ctx.fillStyle = 'rgba(59,130,246,0.15)';
      ctx.fillRect(px, py, this.tileSize, this.tileSize);
    }
  }

  private drawPacman(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const px = x * this.tileSize + this.tileSize / 2;
    const py = y * this.tileSize + this.tileSize / 2;
    const r = this.tileSize * 0.42;

    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(px, py, r, 0.15 * Math.PI, 1.85 * Math.PI);
    ctx.lineTo(px, py);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(px + r * 0.15, py - r * 0.3, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawGhost(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    frightened: boolean,
  ): void {
    const px = x * this.tileSize;
    const py = y * this.tileSize;
    const w = this.tileSize;
    const h = this.tileSize;

    ctx.fillStyle = frightened ? '#60A5FA' : color;

    ctx.beginPath();
    ctx.arc(px + w / 2, py + h / 2, w * 0.42, Math.PI, 0);
    ctx.lineTo(px + w * 0.92, py + h * 0.95);
    ctx.lineTo(px + w * 0.70, py + h * 0.85);
    ctx.lineTo(px + w * 0.50, py + h * 0.95);
    ctx.lineTo(px + w * 0.30, py + h * 0.85);
    ctx.lineTo(px + w * 0.08, py + h * 0.95);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#F9FAFB';
    ctx.beginPath();
    ctx.arc(px + w * 0.40, py + h * 0.48, 3.2, 0, Math.PI * 2);
    ctx.arc(px + w * 0.60, py + h * 0.48, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(px + w * 0.42, py + h * 0.50, 1.6, 0, Math.PI * 2);
    ctx.arc(px + w * 0.62, py + h * 0.50, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}
