export type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

export type Tile =
  | 'wall'
  | 'dot'
  | 'pellet'
  | 'empty'
  | 'gate'
  | 'tunnel';

export interface Position {
  x: number;
  y: number;
}

export interface GhostState {
  id: string;
  color: string;
  pos: Position;
  dir: Direction;
  mode: 'chase' | 'scatter' | 'frightened';
  frightenedTicks: number;
  spawn: Position;
}

export interface GameStateSnapshot {
  level: number;
  score: number;
  lives: number;
  isPaused: boolean;
  isGameOver: boolean;
  message?: string;

  width: number;
  height: number;

  pacman: {
    pos: Position;
    dir: Direction;
    nextDir: Direction;
  };

  ghosts: GhostState[];

  dotsRemaining: number;
  frightenedTicksRemaining: number;
}
