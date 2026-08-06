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
        lastUpdated: "August 6, 2026 (Previously updated: July 22, 2026)",
        sections: [
            {
                title: "Acceptance of Terms",
                content: "By accessing and using XURL (the \"Service\"), you agree to be bound by these Terms of Service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws. If you do not agree with any of these terms, you are explicitly prohibited from using or accessing this site. The materials contained in this website are protected by applicable copyright and trademark law."
            },
            {
                title: "User Accounts and Responsibilities",
                content: "To access certain advanced features of the Service, you may be required to register for an account. You are solely responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account or any other breach of security. XURL cannot and will not be liable for any loss or damage arising from your failure to comply with this security obligation."
            },
            {
                title: "Enterprise Use & E-Policies",
                content: "Corporate and enterprise users are bound by strict 'E-Policies' governing data scraping, API usage limits, and fair usage parameters. Automated creation of links outside the officially provided and authenticated API interfaces is strictly prohibited. Engaging in any form of distributed denial-of-service (DDoS), or attempting to bypass our rate limits using proxy networks or malicious botnets, will result in immediate termination of service and potential legal action."
            },
            {
                title: "Prohibited Conduct",
                content: "You agree not to use the Service to: (a) distribute malware, phishing campaigns, or illegal content; (b) violate the intellectual property rights of others; (c) impersonate any person or entity; (d) harvest or collect email addresses or other contact information of other users from the Service by electronic or other means. We employ advanced algorithmic scanning to detect such violations and will immediately terminate links and accounts found in breach of these conditions."
            },
            {
                title: "Termination and Suspension",
                content: "We reserve the right to suspend or terminate your account and your access to the Service at any time, for any reason, and without notice or liability, including but not limited to if you breach any representation, warranty, or covenant contained in these Terms of Service. Upon termination of your access, your right to use the Service will immediately cease."
            },
            {
                title: "Limitation of Liability",
                content: "In no event shall XURL, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory."
            }
        ]
    },
    "guest-policy": {
        id: "guest-policy",
        title: "Guest Usage Policy",
        lastUpdated: "August 6, 2026 (Previously updated: July 22, 2026)",
        sections: [
            {
                title: "Scope of Guest Access",
                content: "XURL provides limited, unauthenticated access to the Service for \"Guest Users.\" This access is provided strictly as a convenience for temporary or trial use. By utilizing the Service as a Guest User, you acknowledge and agree that your access is subordinate to the rights of registered users and is governed by all applicable provisions of our broader Terms of Service."
            },
            {
                title: "Unregistered Limitations",
                content: "Guest users (unregistered) are subject to highly restrictive rate limits and an ephemeral data model. Specifically, Guest Users are permanently limited to the creation of a single (1) shortened URL per physical user identity. We enforce this limitation using advanced device fingerprinting and IP address hashing. Attempts to bypass this limit via VPNs or Tor nodes are strictly prohibited."
            },
            {
                title: "Data Ephemerality and Privacy",
                content: "Data generated by Guest Users is considered highly ephemeral. Links created by Guest Users are strictly time-bound and will automatically expire and permanently deactivate according to our dynamic platform TTL (Time-To-Live) settings. XURL makes no guarantees regarding the persistence, reliability, or availability of links created without a registered account. We reserve the right to aggressively prune, modify, or delete guest-generated links at our sole discretion to maintain service stability."
            },
            {
                title: "Abuse Prevention and Tracking",
                content: "To maintain platform integrity and prevent malicious spam, we actively monitor guest usage patterns. While we prioritize anonymity, we utilize non-reversible cryptographic hashes of your IP address and device fingerprint solely for the purpose of quota enforcement and abuse prevention. Engaging in abusive behavior as a Guest User will result in permanent network-level blocks."
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
