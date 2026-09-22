import { NextResponse } from "next/server";

export const revalidate = 86400; // Cache for 24 hours (86400 seconds)

export async function GET() {
    try {
        const res = await fetch("https://api.frankfurter.app/latest?from=INR&to=USD,EUR", {
            signal: AbortSignal.timeout(2500),
        });

        if (!res.ok) {
            // Silently fallback if API fails
            return NextResponse.json(
                {
                    rates: {
                        INR: 1,
                        USD: 0.012,
                        EUR: 0.011,
                    },
                },
                {
                    headers: {
                        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
                    },
                }
            );
        }

        const data = await res.json();

        return NextResponse.json(
            {
                rates: {
                    INR: 1,
                    USD: data.rates?.USD || 0.012,
                    EUR: data.rates?.EUR || 0.011,
                },
            },
            {
                headers: {
                    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
                },
            }
        );
    } catch (error) {
        // Fallback to default rates if API fails completely (e.g. timeout)
        return NextResponse.json(
            {
                rates: {
                    INR: 1,
                    USD: 0.012,
                    EUR: 0.011,
                },
            },
            {
                headers: {
                    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
                },
            }
        );
    }
}
