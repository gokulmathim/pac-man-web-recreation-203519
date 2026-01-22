import type { Direction, GameStateSnapshot, GhostState, Position, Tile } from './types';
import type { MazeDefinition } from './maze';

function clonePos(p: Position): Position {
  return { x: p.x, y: p.y };
}

function dirToDelta(dir: Direction): Position {
  switch (dir) {
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

function oppositeDir(dir: Direction): Direction {
  switch (dir) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    default:
      return 'none';
  }
}

function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function inBounds(maze: MazeDefinition, p: Position): boolean {
  return p.y >= 0 && p.y < maze.height && p.x >= 0 && p.x < maze.width;
}

function getTile(maze: MazeDefinition, p: Position): Tile {
  if (!inBounds(maze, p)) return 'wall';
  return maze.tiles[p.y]![p.x]!;
}

function setTile(maze: MazeDefinition, p: Position, t: Tile): void {
  if (!inBounds(maze, p)) return;
  maze.tiles[p.y]![p.x] = t;
}

function isPassable(tile: Tile, forGhost: boolean): boolean {
  if (tile === 'wall') return false;
  if (tile === 'gate') return forGhost;
  return true;
}

function allDirections(): Direction[] {
  return ['up', 'down', 'left', 'right'];
}

export interface EngineOptions {
  tickMs: number;
  frightenedDurationTicks: number;
  levelUpBonus: number;
}

export class PacmanEngine {
  private maze: MazeDefinition;

  private opts: EngineOptions;

  private level = 1;
  private score = 0;
  private lives = 3;

  private pacPos: Position;
  private pacDir: Direction = 'left';
  private pacNextDir: Direction = 'left';

  private ghosts: GhostState[] = [];
  private frightenedTicksRemaining = 0;

  private isPaused = true;
  private isGameOver = false;
  private message: string | undefined = 'Press Start';

  constructor(maze: MazeDefinition, opts?: Partial<EngineOptions>) {
    this.maze = maze;
    this.opts = {
      tickMs: 1000 / 10,
      frightenedDurationTicks: 10 * 7,
      levelUpBonus: 500,
      ...opts,
    };

    this.pacPos = clonePos(this.maze.pacmanStart);

    const ghostColors = ['#EF4444', '#22C55E', '#3B82F6', '#A855F7'];
    this.ghosts = this.maze.ghostSpawns.map((p, idx) => ({
      id: `g${idx + 1}`,
      color: ghostColors[idx] ?? '#EF4444',
      pos: clonePos(p),
      dir: 'left',
      mode: 'scatter',
      frightenedTicks: 0,
      spawn: clonePos(p),
    }));
  }

  // PUBLIC_INTERFACE
  public setPaused(paused: boolean): void {
    /** Pause or unpause the engine. */
    this.isPaused = paused;
    if (paused) this.message = 'Paused';
    else this.message = undefined;
  }

  // PUBLIC_INTERFACE
  public togglePause(): void {
    /** Toggle pause state. */
    this.setPaused(!this.isPaused);
  }

  // PUBLIC_INTERFACE
  public setNextDirection(dir: Direction): void {
    /** Set Pac-Man's requested next direction (from keyboard input). */
    this.pacNextDir = dir;
  }

  // PUBLIC_INTERFACE
  public tick(): { events: string[] } {
    /** Advance simulation by one tick. Returns event strings for audio/UI effects. */
    const events: string[] = [];
    if (this.isPaused || this.isGameOver) return { events };

    if (this.canMove(this.pacPos, this.pacNextDir, false)) {
      this.pacDir = this.pacNextDir;
    }

    if (this.canMove(this.pacPos, this.pacDir, false)) {
      this.pacPos = this.move(this.pacPos, this.pacDir);
    }

    const t = getTile(this.maze, this.pacPos);
    if (t === 'dot') {
      setTile(this.maze, this.pacPos, 'empty');
      this.score += 10;
      events.push('dot');
    } else if (t === 'pellet') {
      setTile(this.maze, this.pacPos, 'empty');
      this.score += 50;
      this.frightenedTicksRemaining = this.opts.frightenedDurationTicks;
      for (const g of this.ghosts) {
        g.mode = 'frightened';
        g.frightenedTicks = this.frightenedTicksRemaining;
      }
      events.push('pellet');
    }

    for (const g of this.ghosts) {
      this.updateGhost(g);
    }

    for (const g of this.ghosts) {
      if (g.pos.x === this.pacPos.x && g.pos.y === this.pacPos.y) {
        if (g.mode === 'frightened' && g.frightenedTicks > 0) {
          this.score += 200;
          g.pos = clonePos(g.spawn);
          g.dir = 'left';
          g.mode = 'scatter';
          g.frightenedTicks = 0;
          events.push('eat-ghost');
        } else {
          this.lives -= 1;
          events.push('die');
          if (this.lives <= 0) {
            this.isGameOver = true;
            this.message = 'Game Over';
          } else {
            this.message = 'Ouch! Try again.';
            this.resetPositions();
          }
          break;
        }
      }
    }

    if (this.frightenedTicksRemaining > 0) {
      this.frightenedTicksRemaining -= 1;
      if (this.frightenedTicksRemaining === 0) {
        for (const g of this.ghosts) {
          g.mode = 'chase';
          g.frightenedTicks = 0;
        }
      }
    }

    const dotsRemaining = this.countDotsRemaining();
    if (dotsRemaining === 0 && !this.isGameOver) {
      this.score += this.opts.levelUpBonus;
      this.level += 1;
      this.message = `Level ${this.level}`;
      events.push('level');
      this.repopulateDots();
      this.resetPositions();
    }

    return { events };
  }

  // PUBLIC_INTERFACE
  public getSnapshot(): GameStateSnapshot {
    /** Return an immutable snapshot for rendering. */
    return {
      level: this.level,
      score: this.score,
      lives: this.lives,
      isPaused: this.isPaused,
      isGameOver: this.isGameOver,
      message: this.message,

      width: this.maze.width,
      height: this.maze.height,

      pacman: {
        pos: clonePos(this.pacPos),
        dir: this.pacDir,
        nextDir: this.pacNextDir,
      },

      ghosts: this.ghosts.map((g) => ({
        ...g,
        pos: clonePos(g.pos),
        spawn: clonePos(g.spawn),
      })),

      dotsRemaining: this.countDotsRemaining(),
      frightenedTicksRemaining: this.frightenedTicksRemaining,
    };
  }

  // PUBLIC_INTERFACE
  public getMazeTiles(): Tile[][] {
    /** Return maze tiles (mutable); treat as read-only from outside. */
    return this.maze.tiles;
  }

  private repopulateDots(): void {
    for (let y = 0; y < this.maze.height; y++) {
      for (let x = 0; x < this.maze.width; x++) {
        const tile = this.maze.tiles[y]![x]!;
        if (tile === 'empty') {
          if (y >= 7 && y <= 11 && x >= 6 && x <= 12) continue;
          this.maze.tiles[y]![x] = 'dot';
        }
      }
    }

    const pelletSpots: Position[] = [
      { x: 1, y: 1 },
      { x: this.maze.width - 2, y: 1 },
      { x: 1, y: this.maze.height - 6 },
      { x: this.maze.width - 4, y: this.maze.height - 6 },
    ];
    for (const p of pelletSpots) {
      if (isPassable(getTile(this.maze, p), false)) setTile(this.maze, p, 'pellet');
    }
  }

  private countDotsRemaining(): number {
    let count = 0;
    for (let y = 0; y < this.maze.height; y++) {
      for (let x = 0; x < this.maze.width; x++) {
        const t = this.maze.tiles[y]![x]!;
        if (t === 'dot' || t === 'pellet') count++;
      }
    }
    return count;
  }

  private resetPositions(): void {
    this.pacPos = clonePos(this.maze.pacmanStart);
    this.pacDir = 'left';
    this.pacNextDir = 'left';

    for (const g of this.ghosts) {
      g.pos = clonePos(g.spawn);
      g.dir = 'left';
      g.mode = 'scatter';
      g.frightenedTicks = 0;
    }
    this.frightenedTicksRemaining = 0;
  }

  private canMove(pos: Position, dir: Direction, forGhost: boolean): boolean {
    const d = dirToDelta(dir);
    const next = { x: pos.x + d.x, y: pos.y + d.y };
    const tile = getTile(this.maze, next);
    return isPassable(tile, forGhost);
  }

  private move(pos: Position, dir: Direction): Position {
    const d = dirToDelta(dir);
    const next = { x: pos.x + d.x, y: pos.y + d.y };

    const tile = getTile(this.maze, next);
    if (tile === 'tunnel' || !inBounds(this.maze, next)) {
      if (next.x < 0) return { x: this.maze.width - 1, y: pos.y };
      if (next.x >= this.maze.width) return { x: 0, y: pos.y };
      return next;
    }

    return next;
  }

  private updateGhost(g: GhostState): void {
    if (g.mode === 'frightened') {
      g.frightenedTicks = Math.max(0, this.frightenedTicksRemaining);
      if (g.frightenedTicks === 0) g.mode = 'chase';
    } else {
      g.mode = this.level % 2 === 0 ? 'chase' : 'scatter';
    }

    const possible: Direction[] = [];
    for (const d of allDirections()) {
      if (oppositeDir(d) === g.dir) continue;
      if (this.canMove(g.pos, d, true)) possible.push(d);
    }

    if (possible.length === 0) {
      const reverse = oppositeDir(g.dir);
      if (reverse !== 'none' && this.canMove(g.pos, reverse, true)) g.dir = reverse;
      else g.dir = 'none';
    } else {
      let target: Position;
      if (g.mode === 'frightened') {
        target = this.pacPos;
        let best = possible[0]!;
        let bestScore = -Infinity;
        for (const d of possible) {
          const np = this.move(g.pos, d);
          const dist = manhattan(np, target);
          if (dist > bestScore) {
            bestScore = dist;
            best = d;
          }
        }
        g.dir = best;
      } else if (g.mode === 'scatter') {
        const corners: Position[] = [
          { x: 1, y: 1 },
          { x: this.maze.width - 2, y: 1 },
          { x: 1, y: this.maze.height - 2 },
          { x: this.maze.width - 2, y: this.maze.height - 2 },
        ];
        target = corners[parseInt(g.id.replace('g', ''), 10) - 1] ?? corners[0]!;
        let best = possible[0]!;
        let bestScore = Infinity;
        for (const d of possible) {
          const np = this.move(g.pos, d);
          const dist = manhattan(np, target);
          if (dist < bestScore) {
            bestScore = dist;
            best = d;
          }
        }
        g.dir = best;
      } else {
        target = this.pacPos;
        let best = possible[0]!;
        let bestScore = Infinity;
        for (const d of possible) {
          const np = this.move(g.pos, d);
          const dist = manhattan(np, target);
          if (dist < bestScore) {
            bestScore = dist;
            best = d;
          }
        }
        g.dir = best;
      }
    }

    if (g.dir !== 'none' && this.canMove(g.pos, g.dir, true)) {
      g.pos = this.move(g.pos, g.dir);
    }
  }
}
