import { NextRequest, NextResponse } from "next/server";
import { submitEmergencyAppeal } from "@/lib/services/kill-switch";
import { z } from "zod";

export const dynamic = "force-dynamic";

const appealSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    message: z.string().min(5, "Message must be at least 5 characters long").max(2000, "Message cannot exceed 2000 characters"),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = appealSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, message: parsed.error.issues[0].message },
                { status: 400 }
            );
        }

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
        const userAgent = request.headers.get("user-agent") || "unknown";

        const appealId = await submitEmergencyAppeal({
            email: parsed.data.email,
            message: parsed.data.message,
            userIp: ip,
            userAgent,
        });

        return NextResponse.json({
            success: true,
            message: "Your emergency appeal has been submitted directly to our engineering team.",
            appealId,
        });
    } catch (err) {
        return NextResponse.json(
            { success: false, message: "Failed to submit emergency appeal", error: String(err) },
            { status: 500 }
        );
    }
}
