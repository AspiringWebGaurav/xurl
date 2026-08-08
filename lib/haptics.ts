export function triggerHaptic(pattern: number | number[] = 50) {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try {
            window.navigator.vibrate(pattern);
        } catch {
            // Ignore
        }
    }
}
