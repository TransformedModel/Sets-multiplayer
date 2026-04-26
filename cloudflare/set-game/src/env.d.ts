import type { GameHub } from './game-hub'

declare global {
  interface Env {
    GAME_HUB: DurableObjectNamespace<GameHub>
  }
}

export {}
