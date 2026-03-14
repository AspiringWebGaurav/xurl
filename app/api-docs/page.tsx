import type { Metadata } from "next";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "API Reference — XURL",
    description:
        "XURL API documentation: link creation, redirect resolution, click analytics, payments, user management, and rate limiting. RESTful endpoints with Firebase Auth.",
    alternates: { canonical: `${seo.url}/api-docs` },
    openGraph: {
        title: "API Reference — XURL",
        description:
            "Complete API documentation for the XURL URL shortening platform.",
        url: `${seo.url}/api-docs`,
        images: [{ url: seo.ogImage, width: 1200, height: 630 }],
    },
};

const endpoints = [
    {
        method: "POST",
        path: "/api/links",
        description: "Create a new short link for guest or authenticated users.",
        auth: "Optional",
        rateLimit: "10/min",
    },
    {
        method: "GET",
        path: "/api/links",
        description: "List the authenticated user's short links with quota info.",
        auth: "Required",
        rateLimit: "—",
    },
    {
        method: "DELETE",
        path: "/api/links",
        description: "Delete a short link and invalidate all caches.",
        auth: "Required",
        rateLimit: "—",
    },
    {
        method: "GET",
        path: "/api/redirect/{slug}",
        description: "Resolve a short link to its destination URL.",
        auth: "None",
        rateLimit: "Abuse scoring",
    },
    {
        method: "GET",
        path: "/api/check-slug",
        description: "Check whether a custom slug is available.",
        auth: "None",
        rateLimit: "30/min",
    },
    {
        method: "GET",
        path: "/api/guest-status",
        description: "Check guest active link status by fingerprint.",
        auth: "None",
        rateLimit: "30/min",
    },
    {
        method: "GET",
        path: "/api/preview",
        description: "Extract title and favicon from a URL (SSRF-safe).",
        auth: "None",
        rateLimit: "20/min",
    },
    {
        method: "POST",
        path: "/api/analytics/click",
        description: "Record a click event for a short link.",
        auth: "None",
        rateLimit: "60/min",
    },
    {
        method: "GET",
        path: "/api/analytics/dashboard",
        description: "Get aggregated analytics for the authenticated user.",
        auth: "Required",
        rateLimit: "—",
    },
    {
        method: "POST",
        path: "/api/payments/create-order",
        description: "Create a Razorpay payment order for a plan upgrade.",
        auth: "Required",
        rateLimit: "10/hr",
    },
    {
        method: "POST",
        path: "/api/payments/verify",
        description: "Verify a Razorpay payment signature and apply upgrade.",
        auth: "Required",
        rateLimit: "—",
    },
    {
        method: "POST",
        path: "/api/payments/webhook",
        description: "Razorpay server-to-server webhook callback.",
        auth: "HMAC Signature",
        rateLimit: "—",
    },
    {
        method: "GET",
        path: "/api/user/profile",
        description: "Get or create the authenticated user's profile.",
        auth: "Required",
        rateLimit: "—",
    },
    {
        method: "PATCH",
        path: "/api/user/profile",
        description: "Update the user's display name and profile.",
        auth: "Required",
        rateLimit: "—",
    },
    {
        method: "POST",
        path: "/api/user/sync",
        description: "Migrate guest link to an authenticated account.",
        auth: "Required",
        rateLimit: "—",
    },
    {
        method: "GET",
        path: "/api/user/transactions",
        description: "Get paginated purchase and plan event history.",
        auth: "Required",
        rateLimit: "—",
    },
    {
        method: "GET",
        path: "/api/exchange-rates",
        description: "Get INR to USD/EUR exchange rates.",
        auth: "None",
        rateLimit: "24h cache",
    },
    {
        method: "POST",
        path: "/api/cleanup",
        description: "Scheduled maintenance: prune analytics, flush Redis.",
        auth: "CLEANUP_SECRET",
        rateLimit: "—",
    },
];

const methodColor: Record<string, string> = {
    GET: "bg-emerald-100 text-emerald-800 border-emerald-200",
    POST: "bg-blue-100 text-blue-800 border-blue-200",
    PATCH: "bg-amber-100 text-amber-800 border-amber-200",
    DELETE: "bg-red-100 text-red-800 border-red-200",
};

export default function ApiDocsPage() {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-background">
            <TopNavbar isCreateDisabled={false} />
            <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 md:py-20">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-4 sm:text-5xl">
                    XURL API Reference
                </h1>
                <p className="text-muted-foreground mb-4 text-base max-w-2xl">
                    The XURL API is a RESTful interface served under <code className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border">/api/</code>.
                    Most endpoints accept a Firebase ID token in the <code className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border">Authorization</code> header.
                </p>
                <p className="text-sm text-muted-foreground mb-12">
                    For full request/response examples, see the{" "}
                    <a
                        href="https://github.com/your-org/xurl/tree/main/Documentation/API.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground transition-colors"
                    >
                        detailed API documentation on GitHub
                    </a>.
                </p>

                <div className="rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/50">
                                    <th className="text-left px-4 py-3 font-medium text-foreground">Method</th>
                                    <th className="text-left px-4 py-3 font-medium text-foreground">Endpoint</th>
                                    <th className="text-left px-4 py-3 font-medium text-foreground hidden md:table-cell">Description</th>
                                    <th className="text-left px-4 py-3 font-medium text-foreground hidden lg:table-cell">Auth</th>
                                    <th className="text-left px-4 py-3 font-medium text-foreground hidden lg:table-cell">Rate Limit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {endpoints.map((ep, i) => (
                                    <tr
                                        key={`${ep.method}-${ep.path}`}
                                        className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                                    >
                                        <td className="px-4 py-3">
                                            <span className={`inline-block text-xs font-mono font-semibold px-2 py-0.5 rounded border ${methodColor[ep.method] ?? "bg-muted text-foreground border-border"}`}>
                                                {ep.method}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                                            {ep.path}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                                            {ep.description}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                                            {ep.auth}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                                            {ep.rateLimit}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="rounded-xl border border-border bg-card p-6">
                        <h2 className="text-base font-semibold text-foreground mb-2">Authentication</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Pass a Firebase ID token as <code className="text-xs bg-muted px-1 py-0.5 rounded">Bearer &lt;token&gt;</code> in
                            the Authorization header. Guest endpoints accept unauthenticated requests.
                        </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-6">
                        <h2 className="text-base font-semibold text-foreground mb-2">Error Format</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            All errors return <code className="text-xs bg-muted px-1 py-0.5 rounded">{`{"error": "message"}`}</code> with
                            standard HTTP status codes: 400, 401, 403, 404, 429, 500.
                        </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-6">
                        <h2 className="text-base font-semibold text-foreground mb-2">Rate Limiting</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Rate limits vary by endpoint. Exceeding limits returns HTTP 429. The XURL protection
                            gateway uses Redis-based abuse scoring for link and redirect endpoints.
                        </p>
                    </div>
                </div>
            </main>
            <HomeFooter />
        </div>
    );
}
