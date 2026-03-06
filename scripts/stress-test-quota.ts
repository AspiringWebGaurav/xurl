import { adminDb } from "../lib/firebase/admin";
import { createLink } from "../services/links";

const TEST_USER_ID = "stress-test-user-123";

async function runTest() {
    console.log(`Starting stress test for user: ${TEST_USER_ID}`);

    // 1. Cleanup before test
    console.log("Cleaning up previous test data...");
    await adminDb.collection("users").doc(TEST_USER_ID).collection("quota").doc("main").delete();
    const linksSnap = await adminDb.collection("links").where("userId", "==", TEST_USER_ID).get();
    if (!linksSnap.empty) {
        const batch = adminDb.batch();
        linksSnap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
    }
    await adminDb.collection("users").doc(TEST_USER_ID).delete();

    // 2. Start measuring concurrency
    console.log("Firing 150 concurrent createLink requests...");
    const promises = [];
    for (let i = 0; i < 150; i++) {
        promises.push(
            createLink(TEST_USER_ID, {
                originalUrl: `https://example.com/test/${i}`,
            })
                .then((res) => ({ success: true, index: i, slug: res.slug }))
                .catch((e) => ({ success: false, index: i, error: e.message }))
        );
    }

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    console.log(`\nTest completed.`);
    console.log(`Successes: ${successes.length}`);
    console.log(`Failures: ${failures.length}`);

    if (successes.length === 100 && failures.length === 50) {
        console.log("\n✅ PASS: Exactly 100 links generated concurrently.");
    } else {
        console.log("\n❌ FAIL: Quota violation detected in concurrency.");
        console.log("First failure:", failures[0]);
        process.exit(1);
    }

    // 3. Test Idempotency
    console.log("\nTesting Idempotency Key...");

    // Before testing idempotency, we need to free up 1 slot in the quota
    // (since we hit exactly 100 above)
    // We can delete the first created link
    if (successes.length > 0) {
        const slugToDelete = (successes[0] as { slug: string }).slug;
        console.log(`Freeing up space: Deleting link ${slugToDelete}...`);
        await adminDb.runTransaction(async (transaction) => {
            const quotaRef = adminDb.collection("users").doc(TEST_USER_ID).collection("quota").doc("main");
            const snap = await transaction.get(quotaRef);
            const data = snap.data();
            if (data && data.activeLinks) {
                data.activeLinks = data.activeLinks.filter((l: { slug: string }) => l.slug !== slugToDelete);
                transaction.set(quotaRef, { activeLinks: data.activeLinks }, { merge: true });
            }
        });
        await adminDb.collection("links").doc(slugToDelete).delete();
    }

    const idempotencyKey = "test-idempotency-key-1";
    try {
        const res1 = await createLink(TEST_USER_ID, {
            originalUrl: "https://example.com/idemp",
            idempotencyKey
        });
        console.log(`First request succeeded, created slug: ${res1.slug}`);

        const res2 = await createLink(TEST_USER_ID, {
            originalUrl: "https://example.com/idemp",
            idempotencyKey
        });
        console.log(`Second request succeeded, returned slug: ${res2.slug}`);

        if (res1.slug === res2.slug) {
            console.log("✅ PASS: Idempotent requests returned the exact same slug without creating a duplicate.");
        } else {
            console.log("❌ FAIL: Idempotent requests returned different slugs.");
            process.exit(1);
        }
    } catch (e: unknown) {
        const err = e as Error;
        console.log(`❌ FAIL: Idempotency test failed with error: ${err.message}`);
        process.exit(1);
    }

    console.log("\nAll tests passed! 🚀");
    process.exit(0);
}

runTest().catch((error) => {
    console.error("Test script failed:", error);
    process.exit(1);
});
