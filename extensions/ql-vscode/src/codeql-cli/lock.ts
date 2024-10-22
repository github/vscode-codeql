import { lock } from "proper-lockfile";

export async function withDistributionUpdateLock(
  lockFile: string,
  f: () => Promise<void>,
) {
  const release = await lock(lockFile, {
    stale: 60_000, // 1 minute. We can take the lock longer than this because that's based on the update interval.
    update: 10_000, // 10 seconds
    retries: {
      minTimeout: 10_000,
      maxTimeout: 60_000,
      retries: 100,
    },
  });

  try {
    await f();
  } finally {
    await release();
  }
}
