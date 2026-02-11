export interface DiscrepancyResult {
  isMismatch: boolean;
  diffPercentage: number;
  diff: number;
}

/** Checks if provider count exceeds recon count beyond the configured threshold percentage */
export function checkDiscrepancy(
  reconTotal: number,
  providerTotal: number,
  threshold: number
): DiscrepancyResult {
  if (reconTotal === 0) {
    return { isMismatch: false, diffPercentage: 0, diff: 0 };
  }

  const diff = providerTotal - reconTotal;
  const diffPercentage = (diff / reconTotal) * 100;

  // Provider count is HIGHER than recon count by more than the threshold %
  const isMismatch = diffPercentage > threshold;

  return { isMismatch, diffPercentage, diff };
}
