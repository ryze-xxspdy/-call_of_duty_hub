/** What every game in the Games hub provides. */
interface GameApi {
  /** Best score saved for this player (null if they have never finished a round). */
  best(): number | null;
  /** Report a finished round. Returns true if it is a new personal best. */
  report(score: number): boolean;
  /** Give the player points (and XP) for a finished round. Call it once per round, when the round ends. */
  award(points: number): void;
  toast(message: string): void;
}

interface GameModule {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  /** Shown next to the best score, e.g. "points" or "seconds". */
  scoreLabel: string;
  /** Short note on the games card about how points are earned, e.g. "30 pts per apple". */
  pointsHint: string;
  /** True for games scored by time / moves, where a smaller number wins. */
  lowerIsBetter?: boolean;
  /** Draw the game inside `root`. Return a cleanup function that removes any listeners / timers. */
  mount(root: HTMLElement, api: GameApi): () => void;
}
