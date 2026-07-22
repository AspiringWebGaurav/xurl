export interface PolicySection {
    title: string;
    id?: string;
    content: string; // Markdown supported
}

export interface Policy {
    id: string;
    title: string;
    lastUpdated: string;
    sections: PolicySection[];
}

export const defaultPolicies: Record<string, Policy> = {
    privacy: {
        id: "privacy",
        title: "Privacy Policy",
        lastUpdated: "July 22, 2026",
        sections: [
            {
                title: "Information We Collect",
                content: "We collect information you provide directly (such as email addresses via Google Auth) and technical information gathered automatically (such as device fingerprints, IP addresses, and click analytics on shortened URLs). IP addresses and device fingerprints are SHA-256 hashed before storage to anonymize users while preventing abuse. We operate a zero-trust architecture, meaning even internal access to this data requires temporary, heavily audited cryptographic grants.",
            },
            {
                title: "Mouse Idle & User Engagement Policy",
                content: "To optimize platform resources and prevent automated abuse, our application actively monitors user interaction state, including mouse movement, keyboard strokes, and scroll events. **If your session is idle for an extended period (typically exceeding 30 minutes without active interaction), your active secure token may be automatically invalidated to protect against session hijacking.** This 'Mouse Idle Policy' ensures enterprise-level security, particularly in shared workspace environments.",
            },
            {
                title: "Cookies and Client-Side Storage",
                content: "We use strictly necessary cookies for authentication via Firebase Auth and to persist consent state (e.g., your agreement to these policies). We utilize a deterministic device fingerprint hash acting as a secure session token to seamlessly track analytics without compromising anonymity. No third-party advertising cookies or tracking pixels are ever injected into our application.",
            },
            {
                title: "Data Retention & Account Bans",
                content: "We enforce zero-tolerance abuse policies. If your account violates our Acceptable Use standards, we reserve the right to retain minimal identifying information (hashed email, IP addresses, device fingerprints) indefinitely to prevent ban evasion. Standard active data is retained as long as your account exists.",
            }
        ]
    },
    terms: {
        id: "terms",
        title: "Terms of Service",
        lastUpdated: "July 22, 2026",
        sections: [
            {
                title: "Acceptance of Terms",
                content: "By accessing XURL, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this site."
            },
            {
                title: "Enterprise Use & E-Policies",
                content: "Corporate users are bound by strict 'E-Policies' governing data scraping, API limits, and fair usage. Automated creation of links outside the provided API interfaces is strictly prohibited. Engaging in any form of distributed denial-of-service, or bypassing our ratelimits using proxy networks, will result in immediate termination of the service."
            }
        ]
    },
    "guest-policy": {
        id: "guest-policy",
        title: "Guest Usage Policy",
        lastUpdated: "July 22, 2026",
        sections: [
            {
                title: "Unregistered Limitations",
                content: "Guest users (unregistered) are subject to highly restrictive rate limits and an ephemeral data model. We reserve the right to prune or modify guest-generated links at our discretion to maintain service stability."
            }
        ]
    },
    "acceptable-use": {
        id: "acceptable-use",
        title: "Acceptable Use Policy",
        lastUpdated: "July 22, 2026",
        sections: [
            {
                title: "Prohibited Content",
                content: "You must not use our service to shorten links leading to malware, phishing sites, illegal content, or any material that infringes upon the intellectual property rights of others. We actively scan endpoints and automatically terminate non-compliant links."
            }
        ]
    },
    "code-of-conduct": {
        id: "code-of-conduct",
        title: "Code of Conduct",
        lastUpdated: "July 22, 2026",
        sections: [
            {
                title: "Community Standards",
                content: "We expect all users interacting within any community-driven aspects of our platform to treat each other with respect. Harassment, abuse, or intimidation will not be tolerated."
            }
        ]
    },
    "open-source": {
        id: "open-source",
        title: "Open Source Policy",
        lastUpdated: "July 22, 2026",
        sections: [
            {
                title: "Attribution & Licenses",
                content: "Our software leverages several open-source libraries. While we offer enterprise services, we adhere strictly to the licenses of our dependencies. See our technical documentation for a complete listing of open-source acknowledgments."
            }
        ]
    },
    refund: {
        id: "refund",
        title: "Refund Policy",
        lastUpdated: "July 22, 2026",
        sections: [
            {
                title: "Standard Refund Terms",
                content: "Due to the nature of our digital services and infrastructure costs, all sales are generally final. However, we offer a 7-day money-back guarantee for initial enterprise plan upgrades if the platform fails to meet your technical requirements. We do not refund accounts that have been terminated for violating our Acceptable Use Policy."
            }
        ]
    }
};
