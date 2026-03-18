import { safeRedis } from "./client";

/**
 * Distributed lock for guest entity creation using Redis SET NX.
 * Prevents duplicate guest creation across multiple server instances.
 */

export async function acquireGuestCreationLock(
  guestId: string,
  ttlSeconds: number = 10
): Promise<boolean> {
  const lockKey = `guest:create:lock:${guestId}`;
  
  // SET NX EX — atomic set-if-not-exists with expiration
  const acquired = await safeRedis(async (client) => {
    const result = await client.set(lockKey, "1", {
      nx: true,  // Only set if not exists
      ex: ttlSeconds,
    });
    return result === "OK";
  });

  return acquired ?? false; // If Redis fails, return false (fail-safe)
}

export async function releaseGuestCreationLock(guestId: string): Promise<void> {
  const lockKey = `guest:create:lock:${guestId}`;
  await safeRedis((client) => client.del(lockKey));
}
