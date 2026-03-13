#!/usr/bin/env node

/**
 * XURL Health Check Script
 *
 * Automatically tests the XURL system's core functionality:
 *  1. API reachability
 *  2. Link creation via POST /api/links (guest + authenticated)
 *  3. Redirect behavior via GET /{slug}
 *  4. Non-existent slug handling
 *  5. Input validation (invalid URLs, missing data, bad protocols)
 *  6. Redirect API expiration response
 *
 * Usage:
 *   node scripts/health-check.mjs [BASE_URL]
 *
 * Example:
 *   node scripts/health-check.mjs http://localhost:3000
 *   node scripts/health-check.mjs https://xurl.eu.cc
 */

const BASE_URL = process.argv[2] || "http://localhost:3000";

// ─── Helpers ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label) {
    passed++;
    console.log(`  ✓ ${label}`);
}

function fail(label, detail) {
    failed++;
    console.log(`  ✗ ${label}`);
    if (detail) console.log(`    → ${detail}`);
}

async function fetchJson(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...options.headers },
        redirect: "manual",
    });
    const isJson =
        res.headers.get("content-type")?.includes("application/json") ?? false;
    const body = isJson ? await res.json() : await res.text();
    return { status: res.status, headers: res.headers, body };
}

// Unique IP per run to avoid guest limit collisions
const RUN_ID = Date.now().toString(36);
const TEST_IP = `10.99.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

// Common test headers: bypass rate limiting + use unique IP
const testHeaders = {
    "x-test-bypass": "true",
    "x-forwarded-for": TEST_IP,
    "x-device-fingerprint": `fp_health_${RUN_ID}`,
};

// Headers for authenticated test users
function authTestHeaders(userId) {
    return {
        ...testHeaders,
        "x-test-user-id": userId,
    };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

async function testApiReachable() {
    console.log("\n── API Reachability ──");
    try {
        const res = await fetch(BASE_URL, { method: "GET" });
        if (res.status === 200) {
            ok("API reachable (GET / returned 200)");
        } else {
            fail("API reachable", `GET / returned ${res.status}`);
        }
    } catch (err) {
        fail("API reachable", err.message);
    }
}

async function testCreateLink() {
    console.log("\n── Link Creation ──");

    // Create as guest (unique IP so we don't hit prior guest limit)
    try {
        const { status, body } = await fetchJson(`${BASE_URL}/api/links`, {
            method: "POST",
            headers: testHeaders,
            body: JSON.stringify({
                originalUrl: "https://example.com/health-check-test",
            }),
        });

        if (status === 201 && body.slug && body.shortUrl && body.originalUrl) {
            ok(`Guest link created (slug: ${body.slug})`);
            return body;
        } else {
            fail("Guest link created", `Status: ${status}, Body: ${JSON.stringify(body)}`);
            return null;
        }
    } catch (err) {
        fail("Guest link created", err.message);
        return null;
    }
}

async function testAuthenticatedLink() {
    console.log("\n── Authenticated Link Creation ──");

    const userId = `health_check_user_${RUN_ID}`;
    try {
        const { status, body } = await fetchJson(`${BASE_URL}/api/links`, {
            method: "POST",
            headers: authTestHeaders(userId),
            body: JSON.stringify({
                originalUrl: "https://example.com/auth-health-check",
            }),
        });

        if (status === 201 && body.slug && body.shortUrl && body.originalUrl) {
            ok(`Auth link created (slug: ${body.slug})`);
            return body;
        } else {
            fail("Auth link created", `Status: ${status}, Body: ${JSON.stringify(body)}`);
            return null;
        }
    } catch (err) {
        fail("Auth link created", err.message);
        return null;
    }
}

async function testRedirect(slug) {
    console.log("\n── Redirect Behavior ──");

    if (!slug) {
        fail("Redirect working", "No slug available (link creation failed)");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/${slug}`, { redirect: "manual" });

        if (res.status === 302 || res.status === 301 || res.status === 307 || res.status === 308) {
            const location = res.headers.get("location");
            if (location && location.includes("example.com")) {
                ok(`Redirect working (→ ${location})`);
            } else {
                fail("Redirect working", `Redirected to unexpected location: ${location}`);
            }
        } else {
            fail("Redirect working", `Expected 3xx redirect, got ${res.status}`);
        }
    } catch (err) {
        fail("Redirect working", err.message);
    }
}

async function testNonExistentSlug() {
    console.log("\n── Non-Existent Slug Handling ──");

    const fakeSlug = `no-such-slug-${RUN_ID}`;

    // Test via proxy (edge middleware redirects to /expired)
    try {
        const res = await fetch(`${BASE_URL}/${fakeSlug}`, { redirect: "manual" });

        if (res.status === 302) {
            const location = res.headers.get("location") || "";
            if (location.includes("/expired")) {
                ok("Non-existent slug redirects to /expired (302)");
            } else {
                fail("Non-existent slug handling", `302 but to unexpected location: ${location}`);
            }
        } else if (res.status === 404) {
            ok("Non-existent slug returns 404");
        } else {
            fail("Non-existent slug handling", `Expected 302→/expired or 404, got ${res.status}`);
        }
    } catch (err) {
        fail("Non-existent slug handling", err.message);
    }

    // Test via API directly (should return 404 JSON)
    try {
        const { status, body } = await fetchJson(`${BASE_URL}/api/redirect/${fakeSlug}`, {
            headers: { "x-test-bypass": "true" },
        });

        if (status === 404) {
            ok("Redirect API returns 404 for non-existent slug");
        } else {
            fail("Redirect API 404", `Expected 404, got ${status}`);
        }
    } catch (err) {
        fail("Redirect API 404", err.message);
    }
}

async function testInputValidation() {
    console.log("\n── Input Validation ──");

    const userId = `health_check_validation_${RUN_ID}`;

    // Test missing originalUrl
    try {
        const { status } = await fetchJson(`${BASE_URL}/api/links`, {
            method: "POST",
            headers: authTestHeaders(userId),
            body: JSON.stringify({}),
        });

        if (status === 400) {
            ok("Rejects missing originalUrl (400)");
        } else {
            fail("Rejects missing originalUrl", `Expected 400, got ${status}`);
        }
    } catch (err) {
        fail("Rejects missing originalUrl", err.message);
    }

    // Test invalid URL (no protocol)
    try {
        const { status } = await fetchJson(`${BASE_URL}/api/links`, {
            method: "POST",
            headers: authTestHeaders(userId),
            body: JSON.stringify({ originalUrl: "not-a-url" }),
        });

        if (status === 400) {
            ok("Rejects invalid URL format (400)");
        } else {
            fail("Rejects invalid URL format", `Expected 400, got ${status}`);
        }
    } catch (err) {
        fail("Rejects invalid URL format", err.message);
    }

    // Test disallowed protocol (ftp)
    try {
        const { status } = await fetchJson(`${BASE_URL}/api/links`, {
            method: "POST",
            headers: authTestHeaders(userId),
            body: JSON.stringify({ originalUrl: "ftp://files.example.com/foo" }),
        });

        if (status === 400) {
            ok("Rejects non-http/https protocol (400)");
        } else {
            fail("Rejects non-http/https protocol", `Expected 400, got ${status}`);
        }
    } catch (err) {
        fail("Rejects non-http/https protocol", err.message);
    }

    // Test guest cannot use custom alias
    try {
        const guestIp = `10.88.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
        const { status, body } = await fetchJson(`${BASE_URL}/api/links`, {
            method: "POST",
            headers: {
                "x-test-bypass": "true",
                "x-forwarded-for": guestIp,
                "x-device-fingerprint": `fp_alias_test_${RUN_ID}`,
            },
            body: JSON.stringify({
                originalUrl: "https://example.com/alias-test",
                customSlug: "my-custom-alias",
            }),
        });

        if (status === 403) {
            ok("Guest blocked from custom alias (403)");
        } else {
            fail("Guest custom alias blocked", `Expected 403, got ${status}`);
        }
    } catch (err) {
        fail("Guest custom alias blocked", err.message);
    }
}

async function testRedirectApiExpiration() {
    console.log("\n── Redirect API Expiration ──");

    // Query redirect API for a slug that doesn't exist — should be 404
    try {
        const { status } = await fetchJson(`${BASE_URL}/api/redirect/expired-test-${RUN_ID}`, {
            headers: { "x-test-bypass": "true" },
        });

        if (status === 404) {
            ok("Redirect API correctly returns 404 for missing slug");
        } else {
            fail("Redirect API missing slug", `Expected 404, got ${status}`);
        }
    } catch (err) {
        fail("Redirect API missing slug", err.message);
    }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🔍 XURL Health Check — ${BASE_URL}\n${"─".repeat(50)}`);

    await testApiReachable();
    const guestLink = await testCreateLink();
    const authLink = await testAuthenticatedLink();
    await testRedirect(guestLink?.slug || authLink?.slug);
    await testNonExistentSlug();
    await testInputValidation();
    await testRedirectApiExpiration();

    console.log(`\n${"─".repeat(50)}`);
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("\n❌ Health check crashed:", err.message);
    process.exit(1);
});
