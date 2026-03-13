#!/usr/bin/env node

/**
 * XURL Stress Test Script
 *
 * Simulates 1000 concurrent users accessing the redirect endpoint.
 *
 * Usage:
 *   node scripts/stress-test.mjs [BASE_URL]
 *
 * Example:
 *   node scripts/stress-test.mjs http://localhost:3000
 *   node scripts/stress-test.mjs https://xurl.eu.cc
 *
 * The script will:
 *   1. Create a test link via the API
 *   2. Fire 1000 concurrent redirect requests
 *   3. Measure latency per request
 *   4. Report aggregated results
 */

const BASE_URL = process.argv[2] || "http://localhost:3000";
const TOTAL_REQUESTS = 1000;
const CONCURRENCY_BATCH = 50; // Fire in batches to avoid socket exhaustion

// ─── Helpers ────────────────────────────────────────────────────────────────

async function createTestLink() {
    const res = await fetch(`${BASE_URL}/api/links`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-test-bypass": "true",
            "x-test-user-id": `stress_test_runner_${Date.now()}`,
        },
        body: JSON.stringify({
            originalUrl: "https://example.com/stress-test-target",
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Failed to create test link: ${res.status} ${body}`);
    }

    const data = await res.json();
    return data.slug;
}

async function fireRedirect(slug) {
    const start = performance.now();
    try {
        const res = await fetch(`${BASE_URL}/${slug}`, { redirect: "manual" });
        const latency = performance.now() - start;
        const isRedirect = res.status >= 300 && res.status < 400;
        return { success: isRedirect, status: res.status, latency };
    } catch (err) {
        const latency = performance.now() - start;
        return { success: false, status: 0, latency, error: err.message };
    }
}

async function runBatch(slug, batchSize) {
    const promises = [];
    for (let i = 0; i < batchSize; i++) {
        promises.push(fireRedirect(slug));
    }
    return Promise.all(promises);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🚀 XURL Stress Test — ${BASE_URL}`);
    console.log(`   Target: ${TOTAL_REQUESTS} requests, ${CONCURRENCY_BATCH} concurrent\n`);
    console.log("─".repeat(50));

    // Step 1: Create test link
    console.log("\n⏳ Creating test link...");
    let slug;
    try {
        slug = await createTestLink();
        console.log(`✓ Test link created: /${slug}\n`);
    } catch (err) {
        console.error(`✗ ${err.message}`);
        process.exit(1);
    }

    // Step 2: Fire requests in batches
    console.log(`⏳ Firing ${TOTAL_REQUESTS} redirect requests...\n`);

    const allResults = [];
    const overallStart = performance.now();
    let completed = 0;

    for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY_BATCH) {
        const batchSize = Math.min(CONCURRENCY_BATCH, TOTAL_REQUESTS - i);
        const results = await runBatch(slug, batchSize);
        allResults.push(...results);
        completed += batchSize;

        // Progress indicator
        const pct = Math.round((completed / TOTAL_REQUESTS) * 100);
        process.stdout.write(`\r   Progress: ${completed}/${TOTAL_REQUESTS} (${pct}%)`);
    }

    const overallDuration = performance.now() - overallStart;

    // Step 3: Aggregate results
    const successful = allResults.filter((r) => r.success);
    const failures = allResults.filter((r) => !r.success);
    const latencies = allResults.map((r) => r.latency).sort((a, b) => a - b);

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const minLatency = latencies[0];
    const maxLatency = latencies[latencies.length - 1];

    // Step 4: Report
    console.log(`\n\n${"─".repeat(50)}\n`);
    console.log("📊 Stress Test Results\n");
    console.log(`   Total requests:        ${TOTAL_REQUESTS}`);
    console.log(`   Successful redirects:   ${successful.length}`);
    console.log(`   Failed redirects:       ${failures.length}`);
    console.log(`   Total duration:         ${overallDuration.toFixed(0)} ms`);
    console.log(`   Requests/sec:           ${((TOTAL_REQUESTS / overallDuration) * 1000).toFixed(1)}`);
    console.log("");
    console.log("   Latency:");
    console.log(`     Average:              ${avgLatency.toFixed(1)} ms`);
    console.log(`     Min:                  ${minLatency.toFixed(1)} ms`);
    console.log(`     P50:                  ${p50.toFixed(1)} ms`);
    console.log(`     P95:                  ${p95.toFixed(1)} ms`);
    console.log(`     P99:                  ${p99.toFixed(1)} ms`);
    console.log(`     Max:                  ${maxLatency.toFixed(1)} ms`);

    if (failures.length > 0) {
        console.log("\n   ⚠ Failure breakdown:");
        const errorCounts = {};
        failures.forEach((f) => {
            const key = f.error || `HTTP ${f.status}`;
            errorCounts[key] = (errorCounts[key] || 0) + 1;
        });
        Object.entries(errorCounts).forEach(([error, count]) => {
            console.log(`     ${error}: ${count}`);
        });

        // Suggest improvements
        console.log("\n   💡 Recommendations:");
        if (avgLatency > 500) {
            console.log("     • Average latency is high — consider in-memory caching (already implemented)");
        }
        if (failures.length > TOTAL_REQUESTS * 0.05) {
            console.log("     • Error rate > 5% — check server logs, may need connection pooling");
        }
        if (maxLatency > 5000) {
            console.log("     • Max latency > 5s — indicates cold starts or Firestore contention");
        }
    }

    console.log(`\n${"─".repeat(50)}\n`);

    if (failures.length > 0) {
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(`\n❌ Stress test crashed: ${err.message}`);
    process.exit(1);
});
