
export interface Vector2D {
  x: number;
  y: number;
}

export enum GameStatus {
  IDLE = 'IDLE',
  FLYING = 'FLYING',
  CRASHED = 'CRASHED',
  SUCCESS = 'SUCCESS'
}

export interface GameState {
  pos: Vector2D;
  vel: Vector2D;
  angle: number; // in radians
  status: GameStatus;
  startTime: number;
  finishTime: number | null;
  trail: Vector2D[];
}

export interface Point {
  x: number;
  y: number;
}
