export const PLAN_DATA: Record<string, {
    badgeName: string;
    badgeStyle: string;
    title: string;
    description: string;
    linkCount: string;
    expiryTime: string;
    linkIconColor: string;
    linkBgColor: string;
    clockIconColor: string;
    clockBgColor: string;
}> = {
    free: {
        badgeName: "Free Plan",
        badgeStyle: "bg-emerald-50 border-emerald-100/50 text-emerald-600",
        title: "Create your account",
        description: "Sign in to instantly unlock:",
        linkCount: "1 Free Link",
        expiryTime: "Limited Expiry",
        linkIconColor: "text-emerald-600",
        linkBgColor: "bg-emerald-100/50",
        clockIconColor: "text-amber-600",
        clockBgColor: "bg-amber-100/50",
    },
    starter: {
        badgeName: "Starter Plan",
        badgeStyle: "bg-amber-50 border-amber-100/50 text-amber-600",
        title: "Upgrade to Starter",
        description: "Sign in to unlock Starter benefits:",
        linkCount: "5 Custom Links",
        expiryTime: "2-Hour Expiry",
        linkIconColor: "text-amber-600",
        linkBgColor: "bg-amber-100/50",
        clockIconColor: "text-blue-600",
        clockBgColor: "bg-blue-100/50",
    },
    pro: {
        badgeName: "Pro Plan",
        badgeStyle: "bg-sky-50 border-sky-100/50 text-sky-600",
        title: "Upgrade to Pro",
        description: "Sign in to unlock Pro benefits:",
        linkCount: "25 Custom Links",
        expiryTime: "6-Hour Expiry",
        linkIconColor: "text-sky-600",
        linkBgColor: "bg-sky-100/50",
        clockIconColor: "text-blue-600",
        clockBgColor: "bg-blue-100/50",
    },
    business: {
        badgeName: "Business Plan",
        badgeStyle: "bg-fuchsia-50 border-fuchsia-100/50 text-fuchsia-600",
        title: "Upgrade to Business",
        description: "Sign in to unlock Business benefits:",
        linkCount: "100 Custom Links",
        expiryTime: "12-Hour Expiry",
        linkIconColor: "text-fuchsia-600",
        linkBgColor: "bg-fuchsia-100/50",
        clockIconColor: "text-indigo-600",
        clockBgColor: "bg-indigo-100/50",
    },
    enterprise: {
        badgeName: "Enterprise Plan",
        badgeStyle: "bg-teal-50 border-teal-100/50 text-teal-600",
        title: "Upgrade to Enterprise",
        description: "Sign in to unlock Enterprise benefits:",
        linkCount: "300 Custom Links",
        expiryTime: "24-Hour Expiry",
        linkIconColor: "text-teal-600",
        linkBgColor: "bg-teal-100/50",
        clockIconColor: "text-emerald-600",
        clockBgColor: "bg-emerald-100/50",
    },
    bigenterprise: {
        badgeName: "Big Enterprise Plan",
        badgeStyle: "bg-slate-100 border-slate-200 text-slate-700",
        title: "Upgrade to Big Enterprise",
        description: "Sign in to unlock maximum capacity:",
        linkCount: "600 Links",
        expiryTime: "24-Hour Expiry",
        linkIconColor: "text-slate-700",
        linkBgColor: "bg-slate-200",
        clockIconColor: "text-slate-700",
        clockBgColor: "bg-slate-200",
    }
};

export function getExpiryDisplay(planKey: string | null, isRenewal: boolean, currentExpiry: number | null) {
    if (!planKey) return "";
    if (planKey === "free") return "Permanent (Free Plan)";
    if (isRenewal && currentExpiry === null) return "Permanent (Admin Granted)";
    return "Valid for 30 Days";
}
