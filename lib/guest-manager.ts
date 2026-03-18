import { getDeviceFingerprint } from "./utils/fingerprint";

export interface GuestStatus {
  active: boolean;
  banned?: boolean;
  publicAccessKey?: string;
  slug?: string;
  originalUrl?: string;
  createdAt?: number;
  expiresIn?: number;
}

/**
 * Singleton manager for guest initialization.
 * Prevents duplicate /api/guest-status calls and ensures single source of truth.
 */
class GuestManager {
  private static instance: GuestManager;
  private initPromise: Promise<GuestStatus> | null = null;
  private cachedStatus: GuestStatus | null = null;
  private fingerprint: string | null = null;

  private constructor() {}

  static getInstance(): GuestManager {
    if (!GuestManager.instance) {
      GuestManager.instance = new GuestManager();
    }
    return GuestManager.instance;
  }

  async initialize(): Promise<GuestStatus> {
    // Return cached if available
    if (this.cachedStatus) {
      return this.cachedStatus;
    }

    // Return in-flight promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start new initialization
    this.initPromise = this.fetchGuestStatus();
    
    try {
      this.cachedStatus = await this.initPromise;
      return this.cachedStatus;
    } finally {
      this.initPromise = null;
    }
  }

  private async fetchGuestStatus(): Promise<GuestStatus> {
    if (!this.fingerprint) {
      this.fingerprint = await getDeviceFingerprint();
    }

    const res = await fetch("/api/guest-status", {
      headers: { 
        "x-device-fingerprint": this.fingerprint,
        "x-idempotency-key": `guest-init-${this.fingerprint}`
      },
    });

    if (!res.ok) {
      throw new Error("Guest status fetch failed");
    }
    
    return res.json();
  }

  invalidate(): void {
    this.cachedStatus = null;
    this.initPromise = null;
  }

  getCachedStatus(): GuestStatus | null {
    return this.cachedStatus;
  }
}

export const guestManager = GuestManager.getInstance();
