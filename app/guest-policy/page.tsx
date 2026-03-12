import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Guest Policy | XURL",
    description: "XURL policy for users without an account.",
};

export default function GuestPolicyPage() {
    return (
        <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-4">Guest User Policy</h1>
            <p className="text-muted-foreground max-w-lg mb-8">
                no login policy will be here
            </p>
        </div>
    );
}
