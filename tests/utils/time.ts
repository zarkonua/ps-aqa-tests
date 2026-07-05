/** Resolve after `ms` milliseconds. */
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait long enough to guarantee the persisted timestamp advances to a **later
 * whole second**. Note timestamps are stored as MySQL `DATETIME` (1-second
 * granularity, half-up rounding), so a >1s gap guarantees two writes land in
 * different second-buckets. Used to make the `created_at`-reset defect (G14 in
 * requirements-gap-analysis.md) observable deterministically instead of relying
 * on create/update happening to straddle a boundary.
 */
export const waitToCrossSecondBoundary = (): Promise<void> => sleep(1100);
