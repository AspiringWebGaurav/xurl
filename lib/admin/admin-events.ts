import { useEffect, useRef } from "react";
import { mutate } from "swr";

const ADMIN_REFRESH_EVENT = "xurl:admin-refresh";

/**
 * Dispatches a global event to refresh all admin data on the page.
 * Optionally takes a Next.js router instance to also trigger a Server Component refresh.
 */
export function emitAdminRefresh(router?: { refresh: () => void }) {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(ADMIN_REFRESH_EVENT));
        try {
            const bc = new BroadcastChannel('xurl-admin-channel');
            bc.postMessage({ type: 'REFRESH' });
            bc.close();
        } catch {}
    }
    // Globally invalidate any active SWR caches
    mutate(() => true, undefined, { revalidate: true });
    
    if (router) {
        router.refresh();
    }
}

/**
 * A custom hook to listen for global admin refresh events and execute a callback.
 */
export function useAdminLiveRefresh(onRefresh?: () => void) {
    const savedCallback = useRef(onRefresh);

    useEffect(() => {
        savedCallback.current = onRefresh;
    }, [onRefresh]);

    useEffect(() => {
        const handleRefresh = () => {
            if (savedCallback.current) {
                savedCallback.current();
            }
        };

        window.addEventListener(ADMIN_REFRESH_EVENT, handleRefresh);
        
        let bc: BroadcastChannel | null = null;
        if (typeof window !== 'undefined') {
            try {
                bc = new BroadcastChannel('xurl-admin-channel');
                bc.onmessage = (event) => {
                    if (event.data?.type === 'REFRESH') {
                        handleRefresh();
                    }
                };
            } catch {}
        }

        return () => {
            window.removeEventListener(ADMIN_REFRESH_EVENT, handleRefresh);
            if (bc) bc.close();
        };
    }, []);
}
