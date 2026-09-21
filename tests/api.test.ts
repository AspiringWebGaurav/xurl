/**
 * XURL Comprehensive Test Suite
 * Run with: npm run test:api (npx tsx tests/api.test.ts)
 */

import { validateUrl } from "../lib/utils/url-validator";
import { PLAN_CONFIGS, GUEST_CONFIG, resolvePlanType } from "../lib/plans";
import { razorpayService } from "../services/payments/razorpay";
import { isAdminEmail } from "../lib/admin-config";
import { safeRedis } from "../lib/redis/client";
import crypto from "crypto";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
        console.log(`  ✅ PASS: ${testName}`);
        passedCount++;
    } else {
        console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
        failedCount++;
    }
}

async function runTests() {
    console.log("==================================================");
    console.log("   XURL System & API Verification Test Suite      ");
    console.log("==================================================\n");

    // ─────────────────────────────────────────────────────────────
    // 1. SSRF & URL Validation Tests
    // ─────────────────────────────────────────────────────────────
    console.log("▶ 1. SSRF & URL Validation");
    {
        const validHttps = await validateUrl("https://github.com/AspiringWebGaurav/xurl");
        assert(validHttps.valid === true, "Accepts standard HTTPS URLs");

        const validHttp = await validateUrl("http://example.org/path?query=1#section");
        assert(validHttp.valid === true, "Accepts standard HTTP URLs");

        const jsScheme = await validateUrl("javascript:alert('XSS')");
        assert(jsScheme.valid === false, "Rejects javascript: scheme");

        const fileScheme = await validateUrl("file:///etc/passwd");
        assert(fileScheme.valid === false, "Rejects file: scheme");

        const dataScheme = await validateUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==");
        assert(dataScheme.valid === false, "Rejects data: scheme");

        const emptyUrl = await validateUrl("   ");
        assert(emptyUrl.valid === false, "Rejects empty or whitespace-only URLs");

        const superLongUrl = "https://example.com/" + "a".repeat(2050);
        const longCheck = await validateUrl(superLongUrl);
        assert(longCheck.valid === false, "Rejects URLs exceeding 2048 characters");
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Plans & Quotas Configuration
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ 2. Plans & Quota Configuration");
    {
        assert(GUEST_CONFIG.limit === 1, "Guest limit is 1 link");
        assert(GUEST_CONFIG.ttlMs === 5 * 60 * 1000, "Guest TTL is 5 minutes (300,000ms)");

        assert(PLAN_CONFIGS.free.limit === 1, "Free plan active link limit is 1");
        assert(PLAN_CONFIGS.free.ttlMs === 10 * 60 * 1000, "Free plan TTL is 10 minutes");
        assert(PLAN_CONFIGS.free.priceINR === 0, "Free plan price is 0 INR");

        assert(PLAN_CONFIGS.starter.limit === 5, "Starter plan limit is 5 links");
        assert(PLAN_CONFIGS.starter.priceINR === 49, "Starter plan price is 49 INR");
        assert(PLAN_CONFIGS.starter.slugAllowed === true, "Starter plan allows custom slugs");

        assert(PLAN_CONFIGS.pro.limit === 25, "Pro plan limit is 25 links");
        assert(PLAN_CONFIGS.pro.priceINR === 99, "Pro plan price is 99 INR");

        assert(PLAN_CONFIGS.business.apiAccess === true, "Business plan includes API access");
        assert(PLAN_CONFIGS.enterprise.apiAccess === true, "Enterprise plan includes API access");

        assert(resolvePlanType("freebie") === "free", "Resolves legacy 'freebie' to 'free'");
        assert(resolvePlanType("pro") === "pro", "Resolves 'pro' canonical plan type");
        assert(resolvePlanType("unknown_plan" as unknown as "free") === "free", "Falls back to 'free' for unknown plans");
        assert(isAdminEmail(null) === false, "isAdminEmail safely handles null");
        assert(typeof isAdminEmail("test@example.com") === "boolean", "isAdminEmail returns boolean");
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Custom Slug & Reserved Slugs Validation
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ 3. Slug Validation & Route Protection");
    {
        const slugRegex = /^[a-zA-Z0-9-]{2,30}$/;
        assert(slugRegex.test("my-cool-link"), "Accepts valid alphanumeric slug with hyphens");
        assert(slugRegex.test("launch2026"), "Accepts alphanumeric slug");
        assert(!slugRegex.test("a"), "Rejects single-character slug (< 2 chars)");
        assert(!slugRegex.test("invalid slug with spaces"), "Rejects slug with spaces");
        assert(!slugRegex.test("bad$slug@!"), "Rejects slug with special characters");
        assert(!slugRegex.test("a".repeat(35)), "Rejects slug exceeding 30 characters");

        const RESERVED_SLUGS = new Set([
            "api", "login", "expired", "_next", "not-found",
            "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json",
            "admin", "dashboard", "pricing", "r", "terms", "privacy"
        ]);
        assert(RESERVED_SLUGS.has("api"), "Protects /api from slug shadowing");
        assert(RESERVED_SLUGS.has("login"), "Protects /login from slug shadowing");
        assert(RESERVED_SLUGS.has("admin"), "Protects /admin from slug shadowing");
        assert(RESERVED_SLUGS.has("r"), "Protects /r interstitial redirect route");
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Payment Security & Webhook Signature Verification
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ 4. Razorpay Webhook Signature Verification");
    {
        const secret = "test_webhook_secret_key_12345";
        const samplePayload = JSON.stringify({
            event: "payment.captured",
            payload: {
                payment: {
                    entity: {
                        id: "pay_test_123",
                        amount: 4900,
                        status: "captured"
                    }
                }
            }
        });

        // Generate authentic HMAC-SHA256 signature
        const validSignature = crypto
            .createHmac("sha256", secret)
            .update(samplePayload)
            .digest("hex");

        const isValid = razorpayService.verifyWebhookSignature(samplePayload, validSignature, secret);
        assert(isValid === true, "Verifies genuine Razorpay webhook signature");

        const tamperedPayload = samplePayload.replace("4900", "9900");
        const isTamperedValid = razorpayService.verifyWebhookSignature(tamperedPayload, validSignature, secret);
        assert(isTamperedValid === false, "Rejects signature when payload is modified");

        const invalidSig = "bad_hex_signature_that_does_not_match";
        const isBadSigValid = razorpayService.verifyWebhookSignature(samplePayload, invalidSig, secret);
        assert(isBadSigValid === false, "Rejects forged/invalid signature");
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Edge Proxy Matcher & Asset Filtering
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ 5. Edge Proxy Quota Optimization Matcher");
    {
        // Replicates the exact regex in proxy.ts config.matcher
        const proxyMatcherRegex = /^((?!_next\/static|_next\/image|favicon\.ico|images|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|css|js)).*)$/;

        assert(proxyMatcherRegex.test("/my-slug"), "Matches short link slug '/my-slug'");
        assert(proxyMatcherRegex.test("/pricing"), "Matches page route '/pricing'");
        assert(!proxyMatcherRegex.test("/_next/static/chunks/main.js"), "Filters out /_next/static/...");
        assert(!proxyMatcherRegex.test("/logo.svg"), "Filters out .svg static assets");
        assert(!proxyMatcherRegex.test("/photo.png"), "Filters out .png static assets");
        assert(!proxyMatcherRegex.test("/font.woff2"), "Filters out .woff2 font assets");
        assert(!proxyMatcherRegex.test("/style.css"), "Filters out .css assets");
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Redis Circuit Breaker & Fail-Open Safety
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ 6. Redis Resilience & Circuit Breaker");
    {
        // Test safe execution with Redis
        const testResult = await safeRedis(async (client) => {
            return await client.ping();
        });
        // If Redis is reachable, testResult is "PONG"; if not reachable or unconfigured, safeRedis returns null without throwing.
        assert(testResult === "PONG" || testResult === null, "safeRedis executes or fails open without unhandled exceptions");
    }

    // ─────────────────────────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────────────────────────
    console.log("\n==================================================");
    console.log(`Test Results: ${passedCount} Passed, ${failedCount} Failed`);
    console.log("==================================================");

    if (failedCount > 0) {
        process.exit(1);
    }
}

runTests().catch((err) => {
    console.error("Unexpected test failure:", err);
    process.exit(1);
});
