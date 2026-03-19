import { NextResponse } from "next/server";

export const revalidate = 86400; // Cache for 24 hours (86400 seconds)

export async function GET() {
    try {
        const res = await fetch("https://api.frankfurter.app/latest?from=INR&to=USD,EUR");

        if (!res.ok) {
            throw new Error(`Failed to fetch exchange rates: ${res.statusText}`);
        }

        const data = await res.json();

        return NextResponse.json({
            rates: {
                INR: 1,
                USD: data.rates.USD || 0.012,
                EUR: data.rates.EUR || 0.011,
            }
        });
    } catch (error) {
        console.error("Error fetching exchange rates:", error);
        // Fallback to default rates if API fails
        return NextResponse.json({
            rates: {
                INR: 1,
                USD: 0.012,
                EUR: 0.011,
            }
        });
    }
}
