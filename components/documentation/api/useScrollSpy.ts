"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ScrollToHeadingOptions {
    behavior?: ScrollBehavior;
    historyMode?: "push" | "replace" | "none";
}

interface UseScrollSpyOptions {
    headingIds: string[];
    headingToSectionMap: Record<string, string>;
}

interface UseScrollSpyResult {
    activeHeadingId: string | null;
    activeSectionId: string | null;
    scrollToHeading: (headingId: string, options?: ScrollToHeadingOptions) => void;
}

const ACTIVE_TOP_OFFSET = 160;

export function useScrollSpy({ headingIds, headingToSectionMap }: UseScrollSpyOptions): UseScrollSpyResult {
    const [activeHeadingId, setActiveHeadingId] = useState<string | null>(headingIds[0] || null);
    const skipReplaceHashRef = useRef(false);

    const setActiveHeadingSafely = useCallback((nextHeadingId: string | null) => {
        setActiveHeadingId((previousHeadingId) =>
            previousHeadingId === nextHeadingId ? previousHeadingId : nextHeadingId
        );
    }, []);

    const computeActiveHeading = useCallback(() => {
        if (typeof document === "undefined" || headingIds.length === 0) return;

        const headingElements = headingIds
            .map((headingId) => ({
                headingId,
                element: document.getElementById(headingId),
            }))
            .filter(
                (entry): entry is { headingId: string; element: HTMLElement } =>
                    Boolean(entry.element)
            );

        if (headingElements.length === 0) return;

        const passedHeadings = headingElements.filter(
            ({ element }) => element.getBoundingClientRect().top <= ACTIVE_TOP_OFFSET
        );

        const nextActiveHeadingId =
            passedHeadings.length > 0
                ? passedHeadings[passedHeadings.length - 1].headingId
                : headingElements[0].headingId;

        setActiveHeadingSafely(nextActiveHeadingId);
    }, [headingIds, setActiveHeadingSafely]);

    const scrollToHeading = useCallback(
        (headingId: string, options?: ScrollToHeadingOptions) => {
            if (typeof window === "undefined") return;

            const targetElement = document.getElementById(headingId);
            if (!targetElement) return;

            const behavior = options?.behavior ?? "smooth";
            const historyMode = options?.historyMode ?? "push";
            const targetHash = `#${headingId}`;
            const targetUrl = `${window.location.pathname}${window.location.search}${targetHash}`;

            if (historyMode === "push") {
                skipReplaceHashRef.current = true;
                window.history.pushState(null, "", targetUrl);
            } else if (historyMode === "replace") {
                skipReplaceHashRef.current = true;
                window.history.replaceState(null, "", targetUrl);
            }

            targetElement.scrollIntoView({ behavior, block: "start" });
            setActiveHeadingSafely(headingId);
        },
        [setActiveHeadingSafely]
    );

    useEffect(() => {
        if (typeof window === "undefined" || headingIds.length === 0) return;

        const initializeFromHashOrViewport = () => {
            const hashHeadingId = decodeURIComponent(window.location.hash.replace("#", ""));
            if (hashHeadingId && headingIds.includes(hashHeadingId)) {
                setActiveHeadingSafely(hashHeadingId);
                return;
            }
            computeActiveHeading();
        };

        const initializationFrame = window.requestAnimationFrame(initializeFromHashOrViewport);

        const onHashChange = () => {
            const nextHashHeadingId = decodeURIComponent(window.location.hash.replace("#", ""));
            if (!nextHashHeadingId || !headingIds.includes(nextHashHeadingId)) return;
            setActiveHeadingSafely(nextHashHeadingId);
        };

        window.addEventListener("hashchange", onHashChange);

        return () => {
            window.cancelAnimationFrame(initializationFrame);
            window.removeEventListener("hashchange", onHashChange);
        };
    }, [headingIds, setActiveHeadingSafely, computeActiveHeading]);

    useEffect(() => {
        if (typeof window === "undefined" || headingIds.length === 0) return;

        if (typeof IntersectionObserver !== "undefined") {
            const observer = new IntersectionObserver(
                () => {
                    computeActiveHeading();
                },
                {
                    root: null,
                    rootMargin: "-20% 0px -60% 0px",
                    threshold: [0, 0.25, 0.5, 0.75, 1],
                }
            );

            headingIds.forEach((headingId) => {
                const element = document.getElementById(headingId);
                if (element) observer.observe(element);
            });

            const onResize = () => computeActiveHeading();
            window.addEventListener("resize", onResize, { passive: true });
            const initialComputeFrame = window.requestAnimationFrame(() => {
                computeActiveHeading();
            });

            return () => {
                observer.disconnect();
                window.cancelAnimationFrame(initialComputeFrame);
                window.removeEventListener("resize", onResize);
            };
        }

        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(() => {
                computeActiveHeading();
                ticking = false;
            });
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
        const initialFallbackFrame = window.requestAnimationFrame(() => {
            computeActiveHeading();
        });

        return () => {
            window.cancelAnimationFrame(initialFallbackFrame);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, [headingIds, computeActiveHeading]);

    useEffect(() => {
        if (typeof window === "undefined" || !activeHeadingId) return;

        if (skipReplaceHashRef.current) {
            skipReplaceHashRef.current = false;
            return;
        }

        const targetHash = `#${activeHeadingId}`;
        if (window.location.hash === targetHash) return;

        const targetUrl = `${window.location.pathname}${window.location.search}${targetHash}`;
        window.history.replaceState(null, "", targetUrl);
    }, [activeHeadingId]);

    const activeSectionId = useMemo(() => {
        if (!activeHeadingId) return null;
        return headingToSectionMap[activeHeadingId] || null;
    }, [activeHeadingId, headingToSectionMap]);

    return {
        activeHeadingId,
        activeSectionId,
        scrollToHeading,
    };
}
