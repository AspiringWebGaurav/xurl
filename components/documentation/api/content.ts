import { seo } from "@/lib/seo";
import type {
    ApiCodeSnippet,
    ApiDocHeadingItem,
    ApiDocSection,
    ApiEndpointDefinition,
    ApiSectionEndpointRelation,
} from "./types";

const rawBaseUrl = process.env.NEXT_PUBLIC_APP_URL || seo.url;

export const PUBLIC_BASE_URL = rawBaseUrl.replace(/\/$/, "");
export const API_BASE_URL = `${PUBLIC_BASE_URL}/api/v1`;

export const API_DOCS_SNIPPETS: Record<string, ApiCodeSnippet> = {
    quickstartCurl: {
        id: "quickstart-curl",
        label: "curl",
        language: "bash",
        code: `curl ${API_BASE_URL}/links \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com"}'`,
    },
    authHeader: {
        id: "auth-header",
        label: "Authorization Header",
        language: "http",
        code: `Authorization: Bearer xurl_sk_live_xxxxxxxxx`,
    },
    createLinkRequest: {
        id: "create-link-request",
        label: "Create Link Request",
        language: "json",
        code: `{
  "url": "https://example.com",
  "title": "Launch page",
  "customSlug": "launch"
}`,
    },
    createLinkResponse: {
        id: "create-link-response",
        label: "Create Link Response",
        language: "json",
        code: `{
  "id": "launch",
  "shortUrl": "${PUBLIC_BASE_URL}/launch",
  "url": "https://example.com",
  "createdAt": 1710000000000
}`,
    },
    listLinksResponse: {
        id: "list-links-response",
        label: "List Links Response",
        language: "json",
        code: `{
  "data": [
    {
      "id": "launch",
      "shortUrl": "${PUBLIC_BASE_URL}/launch",
      "url": "https://example.com",
      "title": "Launch page",
      "clicks": 42,
      "createdAt": 1710000000000,
      "expiresAt": null,
      "status": "active"
    }
  ],
  "pagination": {
    "limit": 20,
    "nextCursor": 1710000000000,
    "hasMore": true
  }
}`,
    },
    analyticsResponse: {
        id: "analytics-response",
        label: "Analytics Response",
        language: "json",
        code: `{
  "id": "launch",
  "clicks": 42,
  "countries": ["US", "IN"],
  "timeline": [
    {
      "date": "2026-03-14",
      "clicks": 12,
      "uniqueVisitors": 10
    }
  ]
}`,
    },
    invalidApiKey: {
        id: "error-invalid-api-key",
        label: "Invalid API Key",
        language: "json",
        code: `{
  "error": "Invalid API key"
}`,
    },
    quotaExceeded: {
        id: "error-quota-exceeded",
        label: "Quota Exceeded",
        language: "json",
        code: `{
  "error": "API quota exceeded"
}`,
    },
    javascriptExample: {
        id: "javascript-example",
        label: "JavaScript",
        language: "javascript",
        code: `const response = await fetch("${API_BASE_URL}/links", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    url: "https://example.com",
    title: "Launch page"
  })
});

const data = await response.json();
console.log(data);`,
    },
    nodeExample: {
        id: "node-example",
        label: "Node.js",
        language: "javascript",
        code: `import fetch from "node-fetch";

const response = await fetch("${API_BASE_URL}/links", {
  method: "POST",
  headers: {
    Authorization: "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ url: "https://example.com" })
});

console.log(await response.json());`,
    },
    listLinksQueryExample: {
        id: "list-links-query",
        label: "List Links with Pagination",
        language: "bash",
        code: `curl "${API_BASE_URL}/links?limit=20&cursor=1710000000000" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
    },
};

export const API_DOCS_ENDPOINTS: Record<string, ApiEndpointDefinition> = {
    createLink: {
        id: "create-link-endpoint",
        method: "POST",
        route: "/api/v1/links",
        description: "Create a short link for the authenticated user.",
        sourceFiles: ["app/api/v1/links/route.ts (POST)", "lib/api/auth.ts (authenticateApiRequest)"],
    },
    listLinks: {
        id: "list-links-endpoint",
        method: "GET",
        route: "/api/v1/links",
        description: "List authenticated user links with cursor pagination.",
        sourceFiles: ["app/api/v1/links/route.ts (GET)", "lib/api/auth.ts (authenticateApiRequest)"],
    },
    analytics: {
        id: "analytics-endpoint",
        method: "GET",
        route: "/api/v1/links/{id}/analytics",
        description: "Fetch analytics timeline and geo summary for a link owned by the API key owner.",
        sourceFiles: ["app/api/v1/links/[id]/analytics/route.ts (GET)", "lib/api/auth.ts (authenticateApiRequest)"],
    },
};

export const API_DOCS_SECTIONS: ApiDocSection[] = [
    {
        id: "introduction",
        title: "Introduction",
        description: "Understand the XURL Developer API surface and where requests are served from.",
        blocks: [
            {
                type: "paragraph",
                text: "XURL Developer API lets you create, list, and analyze short links programmatically.",
            },
            {
                type: "keyValue",
                items: [
                    { label: "Base URL", value: API_BASE_URL },
                    { label: "Key management", value: "/dashboard/api" },
                ],
            },
            {
                type: "callout",
                tone: "info",
                text: "Enable API access from Dashboard before using API keys in production workloads.",
            },
        ],
        subheadings: [
            {
                id: "introduction-response-format",
                title: "Response Format",
                description: "All endpoints return JSON payloads for both success and failures.",
                blocks: [
                    {
                        type: "paragraph",
                        text: "Error responses consistently use {\"error\": \"message\"} and standard HTTP status codes.",
                    },
                ],
            },
            {
                id: "introduction-plan-access",
                title: "Plan Access",
                description: "API key access is controlled by plan capability and API enablement status.",
                blocks: [
                    {
                        type: "list",
                        items: [
                            "Business, Enterprise, and Big Enterprise can enable API access.",
                            "Expired plans fall back to free plan behavior and API access is blocked.",
                            "Disabled API keys return 403 with an access-not-enabled error.",
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: "quick-start",
        title: "Quick Start",
        description: "Make your first authenticated API request in under a minute.",
        blocks: [
            {
                type: "paragraph",
                text: "Start by creating an API key in Dashboard and sending a POST request to create a short link.",
            },
        ],
        subheadings: [
            {
                id: "quick-start-get-api-key",
                title: "Get an API Key",
                blocks: [
                    {
                        type: "list",
                        ordered: true,
                        items: [
                            "Open /dashboard/api",
                            "Generate or rotate your API key",
                            "Store it in a secret manager and never expose it client-side",
                        ],
                    },
                ],
            },
            {
                id: "quick-start-first-request",
                title: "Send First Request",
                endpointIds: ["createLink"],
                blocks: [
                    {
                        type: "endpoint",
                        endpointId: "createLink",
                    },
                    {
                        type: "code",
                        snippetId: "quickstartCurl",
                    },
                ],
            },
        ],
        endpointIds: ["createLink"],
    },
    {
        id: "authentication",
        title: "Authentication",
        description: "All documented endpoints require Bearer API key authentication.",
        blocks: [
            {
                type: "paragraph",
                text: "Authentication is validated via hashed API keys and plan checks before request handling.",
            },
        ],
        subheadings: [
            {
                id: "authentication-header",
                title: "Required Header",
                blocks: [
                    {
                        type: "code",
                        snippetId: "authHeader",
                    },
                ],
            },
            {
                id: "authentication-validation-rules",
                title: "Validation Rules",
                blocks: [
                    {
                        type: "list",
                        items: [
                            "Missing or malformed Bearer token returns 401 Invalid API key.",
                            "Unknown key hash returns 401 Invalid API key.",
                            "Disabled or unsupported plan returns 403 API access is not enabled for your current plan.",
                            "Quota exhaustion returns 403 API quota exceeded.",
                        ],
                    },
                ],
            },
            {
                id: "authentication-quota-usage",
                title: "Quota Side Effect",
                blocks: [
                    {
                        type: "paragraph",
                        text: "Every successful authentication increments API request usage before endpoint logic executes.",
                    },
                ],
            },
        ],
    },
    {
        id: "create-link",
        title: "Create Link",
        description: "Create a short URL with optional title and custom slug.",
        blocks: [
            {
                type: "endpoint",
                endpointId: "createLink",
            },
        ],
        subheadings: [
            {
                id: "create-link-request-body",
                title: "Request Body",
                blocks: [
                    {
                        type: "paragraph",
                        text: "The url field is required. title and customSlug are optional.",
                    },
                    {
                        type: "code",
                        snippetId: "createLinkRequest",
                    },
                ],
            },
            {
                id: "create-link-response",
                title: "Successful Response",
                blocks: [
                    {
                        type: "code",
                        snippetId: "createLinkResponse",
                    },
                ],
            },
            {
                id: "create-link-errors",
                title: "Error Cases",
                blocks: [
                    {
                        type: "list",
                        items: [
                            "400 when url is missing or malformed.",
                            "403 for plan restrictions or quota limits.",
                            "409 when customSlug is already taken.",
                            "429 when upstream rate limit is exceeded.",
                        ],
                    },
                ],
            },
        ],
        endpointIds: ["createLink"],
    },
    {
        id: "list-links",
        title: "List Links",
        description: "Fetch paginated links created by the authenticated user.",
        blocks: [
            {
                type: "endpoint",
                endpointId: "listLinks",
            },
        ],
        subheadings: [
            {
                id: "list-links-query-params",
                title: "Query Parameters",
                blocks: [
                    {
                        type: "list",
                        items: [
                            "limit: integer from 1 to 100 (default 20)",
                            "cursor: createdAt timestamp from previous response",
                        ],
                    },
                    {
                        type: "code",
                        snippetId: "listLinksQueryExample",
                    },
                ],
            },
            {
                id: "list-links-response",
                title: "Response Shape",
                blocks: [
                    {
                        type: "code",
                        snippetId: "listLinksResponse",
                    },
                ],
            },
            {
                id: "list-links-status",
                title: "Status Field",
                blocks: [
                    {
                        type: "list",
                        items: [
                            "active when link is enabled and not expired",
                            "deactivated when isActive is false",
                            "expired when expiresAt is in the past",
                        ],
                    },
                ],
            },
        ],
        endpointIds: ["listLinks"],
    },
    {
        id: "analytics",
        title: "Analytics",
        description: "Retrieve per-link click trends and country breakdown summaries.",
        blocks: [
            {
                type: "endpoint",
                endpointId: "analytics",
            },
        ],
        subheadings: [
            {
                id: "analytics-ownership-rules",
                title: "Ownership Rules",
                blocks: [
                    {
                        type: "list",
                        items: [
                            "404 when the provided link slug does not exist.",
                            "403 when the slug exists but belongs to another user.",
                            "200 with analytics payload for owned links.",
                        ],
                    },
                ],
            },
            {
                id: "analytics-response",
                title: "Response Example",
                blocks: [
                    {
                        type: "code",
                        snippetId: "analyticsResponse",
                    },
                ],
            },
            {
                id: "analytics-window",
                title: "Data Window",
                blocks: [
                    {
                        type: "paragraph",
                        text: "The current endpoint returns a 30-day timeline with daily clicks and unique visitors.",
                    },
                ],
            },
        ],
        endpointIds: ["analytics"],
    },
    {
        id: "quota-limits",
        title: "Quota Limits",
        description: "Understand plan limits and quota-exhaustion behavior.",
        blocks: [
            {
                type: "quotaCards",
                items: [
                    {
                        plan: "Business",
                        limit: "500",
                        description: "total API requests per active purchase",
                    },
                    {
                        plan: "Enterprise",
                        limit: "5000",
                        description: "total API requests per active purchase",
                    },
                ],
            },
        ],
        subheadings: [
            {
                id: "quota-limits-enforcement",
                title: "Enforcement",
                blocks: [
                    {
                        type: "callout",
                        tone: "warning",
                        text: "When quota is exhausted, requests fail with HTTP 403 and API quota exceeded.",
                    },
                    {
                        type: "code",
                        snippetId: "quotaExceeded",
                    },
                ],
            },
            {
                id: "quota-limits-usage-tracking",
                title: "Usage Tracking",
                blocks: [
                    {
                        type: "paragraph",
                        text: "Quota usage and totals are captured on each request and can be surfaced in request logs.",
                    },
                ],
            },
        ],
    },
    {
        id: "errors",
        title: "Errors",
        description: "Common failure responses and troubleshooting pointers.",
        blocks: [
            {
                type: "paragraph",
                text: "Every error payload follows a lightweight JSON shape to simplify client-side handling.",
            },
        ],
        subheadings: [
            {
                id: "errors-payload-format",
                title: "Payload Format",
                blocks: [
                    {
                        type: "code",
                        snippetId: "invalidApiKey",
                    },
                    {
                        type: "code",
                        snippetId: "quotaExceeded",
                    },
                ],
            },
            {
                id: "errors-common-statuses",
                title: "Common Status Codes",
                blocks: [
                    {
                        type: "list",
                        items: [
                            "400 validation failure",
                            "401 invalid API key",
                            "403 plan disabled, unauthorized resource, or quota exceeded",
                            "404 link not found",
                            "409 duplicate custom slug",
                            "429 rate limit exceeded",
                            "500 unexpected server failure",
                        ],
                    },
                ],
            },
            {
                id: "errors-debugging",
                title: "Debugging Checklist",
                blocks: [
                    {
                        type: "list",
                        ordered: true,
                        items: [
                            "Confirm API key and plan status in /dashboard/api",
                            "Verify you are calling /api/v1 routes with a Bearer header",
                            "Check request body JSON and required fields",
                            "Inspect returned error message and status code",
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: "code-examples",
        title: "Code Examples",
        description: "Production-ready examples for curl, JavaScript, and Node.js.",
        blocks: [
            {
                type: "paragraph",
                text: "Use these snippets as a starting point and inject API keys from your secure runtime environment.",
            },
        ],
        subheadings: [
            {
                id: "code-examples-curl",
                title: "curl",
                endpointIds: ["createLink"],
                blocks: [
                    {
                        type: "code",
                        snippetId: "quickstartCurl",
                    },
                ],
            },
            {
                id: "code-examples-javascript",
                title: "JavaScript",
                endpointIds: ["createLink"],
                blocks: [
                    {
                        type: "code",
                        snippetId: "javascriptExample",
                    },
                ],
            },
            {
                id: "code-examples-node",
                title: "Node.js",
                endpointIds: ["createLink"],
                blocks: [
                    {
                        type: "code",
                        snippetId: "nodeExample",
                    },
                ],
            },
        ],
        endpointIds: ["createLink"],
    },
];

export const API_DOCS_HEADING_ITEMS: ApiDocHeadingItem[] = API_DOCS_SECTIONS.flatMap((section) => [
    {
        id: section.id,
        title: section.title,
        level: 2,
        parentSectionId: section.id,
    },
    ...section.subheadings.map((subheading) => ({
        id: subheading.id,
        title: subheading.title,
        level: 3 as const,
        parentSectionId: section.id,
    })),
]);

export const API_DOCS_HEADING_TO_SECTION_MAP: Record<string, string> = Object.fromEntries(
    API_DOCS_HEADING_ITEMS.map((heading) => [heading.id, heading.parentSectionId])
);

export const API_DOCS_SECTION_ENDPOINT_RELATIONS: ApiSectionEndpointRelation[] = API_DOCS_SECTIONS.map(
    (section) => {
        const sectionIds = section.endpointIds || [];
        const subheadingIds = section.subheadings.flatMap((subheading) => subheading.endpointIds || []);
        const endpointIds = Array.from(new Set([...sectionIds, ...subheadingIds]));
        return {
            sectionId: section.id,
            endpointIds,
        };
    }
);
