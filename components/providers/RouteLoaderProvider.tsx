"use client";

import NextTopLoader from "nextjs-toploader";

export function RouteLoaderProvider() {
    return (
        <NextTopLoader
            color="#38bdf8"
            initialPosition={0.12}
            crawlSpeed={200}
            height={3.5}
            crawl={true}
            showSpinner={false}
            easing="cubic-bezier(0.16, 1, 0.3, 1)"
            speed={250}
            shadow="0 0 14px rgba(56, 189, 248, 0.9), 0 0 6px rgba(16, 185, 129, 0.7)"
            zIndex={99999}
        />
    );
}
