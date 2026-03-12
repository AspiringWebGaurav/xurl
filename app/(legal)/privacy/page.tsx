import { TopNavbar } from "@/components/layout/TopNavbar";

export default function PrivacyPage() {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-background">
            <TopNavbar isCreateDisabled={false} />
            <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 md:py-20 flex flex-col gap-6">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Privacy Policy</h1>
                <div className="prose prose-sm dark:prose-invert text-muted-foreground">
                    <p>Last updated: {new Date().toLocaleDateString()}</p>

                    <h3>1. Information We Collect</h3>
                    <p>We collect information you provide directly to us when creating an account (such as email addresses via Google Auth) and technical information gathered automatically (such as device fingerprints, IP addresses, and click analytics on shortened URLs).</p>

                    <h3>2. How We Use Information</h3>
                    <p>We use the collected information to provide, maintain, and improve our Service. This includes enforcing rate limits, preventing abuse, processing payments, and providing analytics to link creators.</p>

                    <h3>3. Data Sharing</h3>
                    <p>We do not sell your personal data. We share necessary data with trusted third-party service providers (like Firebase for database/auth and Razorpay for payment processing) strictly to operate our Service.</p>

                    <h3>4. Data Security</h3>
                    <p>We implement industry-standard security measures to protect your data. However, no method of transmission over the internet or electronic storage is 100% secure.</p>
                </div>
            </main>
        </div>
    );
}
