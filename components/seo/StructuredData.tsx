import { seo } from "@/lib/seo";

/**
 * Renders JSON-LD structured data for search engines.
 *
 * Schemas: Organization, WebApplication, WebSite (with SearchAction).
 * Placed once in the root layout; Google discovers it automatically.
 */
export function StructuredData() {
    const organization = {
        "@type": "Organization",
        name: seo.siteName,
        url: seo.url,
        logo: seo.logo,
        description: seo.description,
        sameAs: [],
    };

    const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
            organization,
            {
                "@type": "WebApplication",
                name: seo.siteName,
                url: seo.url,
                description: seo.description,
                applicationCategory: "BusinessApplication",
                operatingSystem: "Web",
                offers: {
                    "@type": "AggregateOffer",
                    priceCurrency: "INR",
                    lowPrice: "0",
                    highPrice: "999",
                    offerCount: "7",
                },
                provider: organization,
            },
            {
                "@type": "SoftwareApplication",
                name: seo.siteName,
                url: seo.url,
                description: seo.description,
                applicationCategory: "SaaS",
                operatingSystem: "Web",
                offers: {
                    "@type": "Offer",
                    price: "0",
                    priceCurrency: "INR",
                },
                provider: organization,
            },
            {
                "@type": "WebSite",
                name: seo.siteName,
                url: seo.url,
                description: seo.description,
                publisher: organization,
                potentialAction: {
                    "@type": "SearchAction",
                    target: {
                        "@type": "EntryPoint",
                        urlTemplate: `${seo.url}/?focus=true`,
                    },
                    "query-input": "required name=search_term_string",
                },
            },
        ],
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
    );
}
