import type { Metadata } from "next";
import Link from "next/link";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { seo } from "@/lib/seo";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || seo.url;

export const metadata: Metadata = {
    title: "Developer API — XURL",
    description: "Programmatically create, list, analyze, and delete XURL short links with API keys on Business and Enterprise plans.",
    alternates: { canonical: `${seo.url}/documentation/api` },
    openGraph: {
        title: "Developer API — XURL",
        description: "Business and Enterprise API documentation for the XURL developer platform.",
        url: `${seo.url}/documentation/api`,
        images: [{ url: seo.ogImage, width: 1200, height: 630 }],
    },
};

const sections = [
    { id: "quickstart", label: "Quick Start" },
    { id: "authentication", label: "Authentication" },
    { id: "create-link", label: "Create Link" },
    { id: "list-links", label: "List Links" },
    { id: "analytics", label: "Analytics" },
    { id: "quota", label: "Quota Limits" },
    { id: "errors", label: "Error Handling" },
    { id: "examples", label: "Code Examples" },
];

function CodeBlock({ code }: { code: string }) {
    return (
        <pre className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-100 shadow-sm">
            <code>{code}</code>
        </pre>
    );
}

export default function DeveloperApiDocumentationPage() {
    const quickstartCurl = `curl ${baseUrl}/api/v1/links \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com"}'`;

    const jsExample = `const response = await fetch("${baseUrl}/api/v1/links", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ url: "https://example.com" })
});

const data = await response.json();
console.log(data);`;

    const nodeExample = `import fetch from "node-fetch";

const response = await fetch("${baseUrl}/api/v1/links", {
  method: "POST",
  headers: {
    Authorization: "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ url: "https://example.com" })
});

console.log(await response.json());`;

    return (
        <div className="flex min-h-[100dvh] flex-col bg-slate-50">
            <TopNavbar />
            <main className="flex-1 px-6 py-12 md:py-16">
                <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
                    <aside className="lg:sticky lg:top-6 lg:self-start">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Developer API</p>
                            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">XURL API</h1>
                            <p className="mt-2 text-sm text-slate-500">Business and Enterprise plans can generate API keys from <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">/dashboard/api</code>.</p>
                            <nav className="mt-5 space-y-2 text-sm">
                                {sections.map((section) => (
                                    <a key={section.id} href={`#${section.id}`} className="block rounded-lg px-3 py-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                                        {section.label}
                                    </a>
                                ))}
                            </nav>
                        </div>
                    </aside>

                    <div className="space-y-8">
                        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Introduction</p>
                                    <h2 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Programmatic link creation for XURL</h2>
                                    <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                                        XURL API allows developers to programmatically create and manage short links. API access is available on Business, Enterprise, and Big Enterprise plans.
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                    Base URL: <code className="font-mono text-slate-900">{baseUrl}/api/v1</code>
                                </div>
                            </div>
                        </section>

                        <section id="quickstart" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                            <h3 className="text-2xl font-bold tracking-tight text-slate-900">Quick Start</h3>
                            <p className="mt-3 text-slate-600">Generate an API key from <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">Dashboard → API Keys</code>, then send a request with the key in the Authorization header.</p>
                            <div className="mt-5">
                                <CodeBlock code={quickstartCurl} />
                            </div>
                        </section>

                        <section id="authentication" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                            <h3 className="text-2xl font-bold tracking-tight text-slate-900">Authentication</h3>
                            <p className="mt-3 text-slate-600">All developer endpoints require a bearer API key.</p>
                            <div className="mt-5 grid gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-sm font-semibold text-slate-900">Header</p>
                                    <p className="mt-2 font-mono text-sm text-slate-700">Authorization: Bearer xurl_sk_live_xxxxxxxxx</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-sm font-semibold text-slate-900">Where to get it</p>
                                    <p className="mt-2 text-sm text-slate-600">Open <Link href="/dashboard/api" className="font-medium text-slate-900 underline underline-offset-4">/dashboard/api</Link> and copy your active key.</p>
                                </div>
                            </div>
                        </section>

                        <section id="create-link" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                            <h3 className="text-2xl font-bold tracking-tight text-slate-900">Create Short Link</h3>
                            <p className="mt-3 text-slate-600"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">POST /api/v1/links</code></p>
                            <div className="mt-5 grid gap-4 lg:grid-cols-2">
                                <div>
                                    <p className="mb-2 text-sm font-semibold text-slate-900">Request body</p>
                                    <CodeBlock code={`{
  "url": "https://example.com"
}`} />
                                </div>
                                <div>
                                    <p className="mb-2 text-sm font-semibold text-slate-900">Response</p>
                                    <CodeBlock code={`{
  "id": "abc123",
  "shortUrl": "${baseUrl.replace(/\/$/, "")}/abc123",
  "url": "https://example.com",
  "createdAt": 1710000000000
}`} />
                                </div>
                            </div>
                        </section>

                        <section id="list-links" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                            <h3 className="text-2xl font-bold tracking-tight text-slate-900">List Links</h3>
                            <p className="mt-3 text-slate-600"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">GET /api/v1/links</code></p>
                            <p className="mt-3 text-slate-600">Use <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">limit</code> and <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">cursor</code> for pagination. Responses include <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">pagination.nextCursor</code> when another page is available.</p>
                        </section>

                        <section id="analytics" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                            <h3 className="text-2xl font-bold tracking-tight text-slate-900">Analytics Endpoint</h3>
                            <p className="mt-3 text-slate-600"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">GET /api/v1/links/{`{id}`}/analytics</code></p>
                            <div className="mt-5">
                                <CodeBlock code={`{
  "id": "abc123",
  "clicks": 42,
  "countries": ["US", "IN"],
  "timeline": [
    { "date": "2026-03-14", "clicks": 12, "uniqueVisitors": 10 }
  ]
}`} />
                            </div>
                        </section>

                        <section id="quota" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                            <h3 className="text-2xl font-bold tracking-tight text-slate-900">Quota Limits</h3>
                            <div className="mt-5 grid gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                    <p className="text-sm font-semibold text-slate-900">Business Plan</p>
                                    <p className="mt-2 text-3xl font-bold text-slate-900">500</p>
                                    <p className="mt-1 text-sm text-slate-500">total API requests per active purchase</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                    <p className="text-sm font-semibold text-slate-900">Enterprise Plan</p>
                                    <p className="mt-2 text-3xl font-bold text-slate-900">5000</p>
                                    <p className="mt-1 text-sm text-slate-500">total API requests per active purchase</p>
                                </div>
                            </div>
                            <p className="mt-4 text-slate-600">When quota is exhausted, the API returns <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">403 API quota exceeded</code>.</p>
                        </section>

                        <section id="errors" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                            <h3 className="text-2xl font-bold tracking-tight text-slate-900">Error Handling</h3>
                            <div className="mt-5 grid gap-4 lg:grid-cols-2">
                                <div>
                                    <p className="mb-2 text-sm font-semibold text-slate-900">Invalid API key</p>
                                    <CodeBlock code={`{
  "error": "Invalid API key"
}`} />
                                </div>
                                <div>
                                    <p className="mb-2 text-sm font-semibold text-slate-900">Quota exceeded</p>
                                    <CodeBlock code={`{
  "error": "API quota exceeded"
}`} />
                                </div>
                            </div>
                        </section>

                        <section id="examples" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                            <h3 className="text-2xl font-bold tracking-tight text-slate-900">Code Examples</h3>
                            <div className="mt-6 space-y-6">
                                <div>
                                    <p className="mb-2 text-sm font-semibold text-slate-900">curl</p>
                                    <CodeBlock code={quickstartCurl} />
                                </div>
                                <div>
                                    <p className="mb-2 text-sm font-semibold text-slate-900">JavaScript</p>
                                    <CodeBlock code={jsExample} />
                                </div>
                                <div>
                                    <p className="mb-2 text-sm font-semibold text-slate-900">Node.js</p>
                                    <CodeBlock code={nodeExample} />
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
            <HomeFooter />
        </div>
    );
}
