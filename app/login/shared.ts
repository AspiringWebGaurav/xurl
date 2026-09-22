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
        linkCount: "5 Permanent Links",
        expiryTime: "Permanent Uptime",
        linkIconColor: "text-emerald-600",
        linkBgColor: "bg-emerald-100/50",
        clockIconColor: "text-amber-600",
        clockBgColor: "bg-amber-100/50",
    },
    starter: {
        badgeName: "Starter Plan",
        badgeStyle: "bg-amber-50 border-amber-100/50 text-amber-600",
        title: "Upgrade to Starter",
        description: "Unlock Starter benefits & API access:",
        linkCount: "25 Permanent Links",
        expiryTime: "Permanent Uptime",
        linkIconColor: "text-amber-600",
        linkBgColor: "bg-amber-100/50",
        clockIconColor: "text-blue-600",
        clockBgColor: "bg-blue-100/50",
    },
    pro: {
        badgeName: "Pro Plan",
        badgeStyle: "bg-sky-50 border-sky-100/50 text-sky-600",
        title: "Upgrade to Pro",
        description: "Unlock Pro benefits & high-volume API:",
        linkCount: "100 Permanent Links",
        expiryTime: "Permanent Uptime",
        linkIconColor: "text-sky-600",
        linkBgColor: "bg-sky-100/50",
        clockIconColor: "text-blue-600",
        clockBgColor: "bg-blue-100/50",
    },
    business: {
        badgeName: "Business Plan",
        badgeStyle: "bg-fuchsia-50 border-fuchsia-100/50 text-fuchsia-600",
        title: "Upgrade to Business",
        description: "Unlock Business benefits & 60K API calls:",
        linkCount: "500 Permanent Links",
        expiryTime: "Permanent Uptime",
        linkIconColor: "text-fuchsia-600",
        linkBgColor: "bg-fuchsia-100/50",
        clockIconColor: "text-indigo-600",
        clockBgColor: "bg-indigo-100/50",
    },
    enterprise: {
        badgeName: "Enterprise Plan",
        badgeStyle: "bg-teal-50 border-teal-100/50 text-teal-600",
        title: "Upgrade to Enterprise",
        description: "Unlock Enterprise benefits & 300K API calls:",
        linkCount: "2,500 Permanent Links",
        expiryTime: "Permanent Uptime",
        linkIconColor: "text-teal-600",
        linkBgColor: "bg-teal-100/50",
        clockIconColor: "text-emerald-600",
        clockBgColor: "bg-emerald-100/50",
    },
    bigenterprise: {
        badgeName: "Big Enterprise Plan",
        badgeStyle: "bg-slate-100 border-slate-200 text-slate-700",
        title: "Upgrade to Big Enterprise",
        description: "Unlock maximum scale & 1M API calls:",
        linkCount: "10,000 Permanent Links",
        expiryTime: "Permanent Uptime",
        linkIconColor: "text-slate-700",
        linkBgColor: "bg-slate-200",
        clockIconColor: "text-slate-700",
        clockBgColor: "bg-slate-200",
    }
};

export function getExpiryDisplay(planKey: string | null, isRenewal: boolean, currentExpiry: number | null) {
    if (!planKey) return "";
    return "Permanent Links (30D API)";
}
