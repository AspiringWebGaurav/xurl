import { Logo } from "@/components/ui/Logo";

export default function PlaceholderPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8">
            <Logo size="lg" />
            <div className="mt-8 text-xl font-medium text-slate-500">
                Content goes here
            </div>
        </div>
    );
}
