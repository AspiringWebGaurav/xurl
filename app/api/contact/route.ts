import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { z } from "zod";
import crypto from "crypto";
import { logger } from "@/lib/utils/logger";

const contactSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
    email: z.string().trim().toLowerCase().email("Invalid email format"),
    subject: z.string().trim().max(200, "Subject too long").optional().nullable(),
    message: z.string().trim().min(10, "Message too short").max(2000, "Message too long"),
});

type RateLimitEntry = {
    count: number;
    resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 3;

function cleanupExpiredEntries() {
    const now = Date.now();
    for (const [ip, entry] of rateLimitStore.entries()) {
        if (entry.resetAt <= now) {
            rateLimitStore.delete(ip);
        }
    }
}

function checkRateLimit(ip: string): { allowed: boolean; resetAt?: number } {
    cleanupExpiredEntries();
    
    const now = Date.now();
    const entry = rateLimitStore.get(ip);
    
    if (!entry) {
        rateLimitStore.set(ip, {
            count: 1,
            resetAt: now + RATE_LIMIT_WINDOW_MS,
        });
        return { allowed: true };
    }
    
    if (entry.resetAt <= now) {
        rateLimitStore.set(ip, {
            count: 1,
            resetAt: now + RATE_LIMIT_WINDOW_MS,
        });
        return { allowed: true };
    }
    
    if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
        return { allowed: false, resetAt: entry.resetAt };
    }
    
    rateLimitStore.set(ip, {
        count: entry.count + 1,
        resetAt: entry.resetAt,
    });
    return { allowed: true };
}

function getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    
    if (realIp) {
        return realIp;
    }
    
    return "unknown";
}

function hashIp(ip: string): string {
    return crypto.createHash("sha256").update(ip).digest("hex");
}

export async function POST(request: NextRequest) {
    try {
        const ip = getClientIp(request);
        
        const rateLimitCheck = checkRateLimit(ip);
        if (!rateLimitCheck.allowed) {
            const resetIn = rateLimitCheck.resetAt ? Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000 / 60) : 10;
            return NextResponse.json(
                { message: `Rate limit exceeded. Please try again in ${resetIn} minutes.` },
                { status: 429 }
            );
        }
        
        const body = await request.json();
        const validatedData = contactSchema.parse(body);
        
        const userAgent = request.headers.get("user-agent");
        const ipHash = hashIp(ip);
        
        const now = Date.now();
        const docRef = await adminDb.collection("contact_submissions").add({
            name: validatedData.name,
            email: validatedData.email,
            subject: validatedData.subject || null,
            message: validatedData.message,
            status: "new",
            isResolved: false,
            createdAt: now,
            updatedAt: now,
            userAgent: userAgent || null,
            ipHash,
        });
        
        return NextResponse.json(
            { success: true, id: docRef.id },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            const firstError = error.issues[0];
            return NextResponse.json(
                { message: firstError.message },
                { status: 400 }
            );
        }
        
        logger.error("contact_submission_error", "Failed to submit contact form", {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { message: "Failed to submit contact form. Please try again." },
            { status: 500 }
        );
    }
}
