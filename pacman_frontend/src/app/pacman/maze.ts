import type { Position, Tile } from './types';

export interface MazeDefinition {
  width: number;
  height: number;
  tiles: Tile[][];
  pacmanStart: Position;
  ghostSpawns: Position[];
}

const MAP = [
  // 19x19-ish compact maze. Symbols:
  // # wall, . dot, o power pellet, ' ' empty, = gate, T tunnel
  '###################',
  '#o........#........#',
  '#.#####.###.#####..#',
  '#.#   #.....#   #..#',
  '#.#####.###.#####..#',
  '#.......#.#........#',
  '###.###.#.#.###.####',
  '#...#.........#....#',
  '#.###.##===##.###..#',
  '#.....#  #  #......#',
  '###.###  #  ###.####',
  '#.......#.#........#',
  '#.#####.#.#.#####..#',
  '#o....#.....#....o.#',
  '#####.###.###.#####T',
  '#........#........##',
  '#.######.#.######..#',
  '#.................##',
  '###################',
].map((row) => row.padEnd(19, '#'));

function symbolToTile(ch: string): Tile {
  if (ch === '#') return 'wall';
  if (ch === '.') return 'dot';
  if (ch === 'o') return 'pellet';
  if (ch === '=') return 'gate';
  if (ch === 'T') return 'tunnel';
  return 'empty';
}

// PUBLIC_INTERFACE
export function createDefaultMaze(): MazeDefinition {
  /** Create the default maze definition (grid of tiles + start positions). */
  const height = MAP.length;
  const width = MAP[0]!.length;

  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    const row = MAP[y]!;
    const tileRow: Tile[] = [];
    for (let x = 0; x < width; x++) {
      tileRow.push(symbolToTile(row[x] ?? '#'));
    }
    tiles.push(tileRow);
  }

  const pacmanStart: Position = { x: 9, y: 15 };
  const ghostSpawns: Position[] = [
    { x: 8, y: 9 },
    { x: 9, y: 9 },
    { x: 10, y: 9 },
    { x: 9, y: 8 },
  ];

  tiles[pacmanStart.y]![pacmanStart.x] = 'empty';
  for (const g of ghostSpawns) {
    tiles[g.y]![g.x] = 'empty';
  }

  return { width, height, tiles, pacmanStart, ghostSpawns };
}
