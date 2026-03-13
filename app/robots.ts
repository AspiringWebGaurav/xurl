import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://xurl.eu.cc";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/dashboard", "/api/", "/auth", "/r/", "/expired"],
            },
        ],
        sitemap: `${BASE_URL}/sitemap.xml`,
    };
}
