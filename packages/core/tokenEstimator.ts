/**
 * Token Estimator (P1.7)
 * Encapsulates token estimation behind an interface for future model-specific tokenizers.
 * Defaults to Math.ceil(characters / 4).
 */

export interface TokenEstimator {
  estimate(text: string): number;
}

export class CharDivisionTokenEstimator implements TokenEstimator {
  constructor(private charsPerToken: number = 4) {}

  estimate(text: string): number {
    if (!text || text.length === 0) return 0;
    return Math.ceil(text.length / this.charsPerToken);
  }
}

export const defaultTokenEstimator = new CharDivisionTokenEstimator();
