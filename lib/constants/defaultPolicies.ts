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
        lastUpdated: "August 7, 2026 (Previously revised: July 22, 2026)",
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
                title: "Emergency Appeals Data Protocol",
                content: "During active Emergency Maintenance Holds (Kill Switch mode), direct appeal submissions (user email and inquiry details) are stored with zero-trust encryption in administrative logs. This data is accessed exclusively by authorized security engineers solely for incident resolution and emergency query response.",
            },
            {
                title: "Data Retention & Account Bans",
                content: "We enforce zero-tolerance abuse policies. If your account violates our Acceptable Use standards, we reserve the right to retain minimal identifying information (hashed email, IP addresses, device fingerprints) indefinitely to prevent ban evasion. Standard active data is retained as long as your account exists.",
            },
            {
                title: "Data Portability & User Archive Export Rights (GDPR / CCPA)",
                content: "All registered XURL accounts (Free, Starter, Pro, Business, and Enterprise) possess the unconditional right to export a machine-readable data archive of their account profile, shortened URL records, click telemetry, and billing history. Data exports may be requested at any time via our dedicated Data Portability Portal (/data-export). Guest accounts are unauthenticated and ephemeral, and are therefore excluded from data archive exports under our Guest Usage Policy.",
            }
        ]
    },
    terms: {
        id: "terms",
        title: "Terms of Service",
        lastUpdated: "August 7, 2026 (Previously revised: July 22, 2026)",
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
            },
            {
                title: "Emergency Service Hold & Maintenance Protocol",
                content: "XURL administrators reserve the unilateral right to engage a Global Emergency Hold ('Kill Switch') during active security threats, system migrations, or database integrity checks. During an Emergency Hold, public link creation, billing checkouts, and profile edits are temporarily paused. Existing shortened link redirects remain operational. Users may submit direct emergency appeals through our maintenance interface."
            },
            {
                title: "Strict Policy-Driven Infrastructure & Governance",
                content: "XURL operates strictly on automated policy enforcement. All user actions, guest quotas, rate limits, tier upgrades, and emergency maintenance holds are strictly governed by our published binding legal and technical policies. No manual overrides, informal exceptions, or undocumented API privileges are granted under any circumstances."
            },
            {
                title: "Proprietary Architecture & Trade Secret Protection",
                content: "To safeguard system security and protect platform innovations from malicious reverse-engineering, XURL retains full intellectual property rights over its internal Edge routing architecture, proprietary abuse scoring algorithms, and database indexing schemas. Public documentation details external interface contracts only; full internal system mechanics remain proprietary trade secrets."
            }
        ]
    },
    "emergency-policy": {
        id: "emergency-policy",
        title: "Emergency Protocol & Incident Response Policy",
        lastUpdated: "August 7, 2026 (Effective: August 7, 2026)",
        sections: [
            {
                title: "1. Global Emergency Kill Switch Protocol",
                content: "To protect system integrity, database security, and prevent distributed abuse during active security incidents, XURL administrators reserve the right to engage a global Emergency Maintenance Hold ('Kill Switch'). During an active Emergency Hold, all public shortener interfaces, account controls, and payment checkouts are temporarily paused."
            },
            {
                title: "2. Edge Interception & Link Operational State",
                content: "During an Emergency Hold, existing shortened link redirects remain active and operational via our Edge CDN cache layer. However, API endpoints block non-administrative requests with HTTP 503 Service Unavailable."
            },
            {
                title: "3. Direct Emergency Appeals Process",
                content: "Users impacted by an Emergency Hold or requiring urgent business assistance may submit a Direct Emergency Appeal via our edge maintenance interface. Submissions are transmitted directly to administrator security logs for priority review."
            },
            {
                title: "4. Admin Bypass & Restoration",
                content: "Only verified administrator accounts are granted bypass permissions during an Emergency Hold. When system safety is confirmed, administrators disengage the Kill Switch, triggering an automated 3-2-1 restoration sequence and system pre-loader."
            }
        ]
    },
    "guest-policy": {
        id: "guest-policy",
        title: "Guest Usage Policy",
        lastUpdated: "August 7, 2026 (Previously revised: July 22, 2026)",
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
        lastUpdated: "August 7, 2026 (Previously revised: July 22, 2026)",
        sections: [
            {
                title: "1. Prohibited Content Categories",
                content: "You are strictly prohibited from using XURL to shorten, mask, or redirect to any URLs that contain or promote: (a) malware, ransomware, spyware, or malicious payloads; (b) phishing schemes, credential harvesters, or deceptive landing pages; (c) illegal substances, unauthorized pharmaceuticals, or illicit contraband; (d) copyright infringement or stolen intellectual property; (e) spam campaigns, unsolicited commercial messages, or automated bot traffic."
            },
            {
                title: "2. Automated Threat Scanning & Algorithmic Termination",
                content: "XURL employs continuous automated threat detection, Google Safe Browsing telemetry, and real-time destination URL inspection. Any shortened link found to resolve to a high-risk or flagged endpoint will be **immediately suspended or permanently deleted without prior notice**. Repeated submission of non-compliant links will result in an immediate account ban."
            },
            {
                title: "3. Network Exploitation & DDoS Restrictions",
                content: "Attempting to bypass platform rate limits, probe internal Edge APIs, deploy automated scraping scripts, or participate in distributed denial-of-service (DDoS) attacks against XURL infrastructure is prohibited. Violators will have their IP range and device fingerprints added to our perpetual firewall blocklist."
            },
            {
                title: "4. Ban Enforcement & Loss of Access",
                content: "When an account or identity is banned for violating this policy, all active shortened links associated with that identity are permanently revoked. Banned users forfeit all accrued subscription quotas, custom slugs, and analytics history."
            }
        ]
    },
    "code-of-conduct": {
        id: "code-of-conduct",
        title: "Code of Conduct",
        lastUpdated: "August 7, 2026 (Previously revised: July 22, 2026)",
        sections: [
            {
                title: "1. Community & Support Interaction Standards",
                content: "XURL is committed to maintaining a professional, safe, and respectful environment for all users, developer contributors, and support staff. Users interacting with XURL representatives via direct appeals, support channels, or community forums must refrain from abusive language, harassment, discrimination, or malicious behavior."
            },
            {
                title: "2. Zero Tolerance for Harassment & Intimidation",
                content: "Threats of violence, hate speech, targeted harassment, or attempts to doxx XURL team members or other users will result in immediate termination of all account privileges and potential referral to law enforcement agencies."
            }
        ]
    },
    "open-source": {
        id: "open-source",
        title: "Open Source Policy",
        lastUpdated: "August 7, 2026 (Previously revised: July 22, 2026)",
        sections: [
            {
                title: "1. Attribution & Underlying Dependencies",
                content: "XURL builds upon industry-standard open-source libraries, including React, Next.js, Framer Motion, Tailwind CSS, Lucide Icons, and Firebase Web SDKs. We acknowledge and respect the open-source community, adhering strictly to the licenses (MIT, Apache 2.0, BSD) of our upstream dependencies."
            },
            {
                title: "2. Dual Licensing & Proprietary Add-ons",
                content: "While XURL integrates open-source components, proprietary Edge routing proxies, custom anti-abuse scoring engines, and administrative control tools are proprietary trade secrets of XURL. Reuse of proprietary XURL branding, assets, or proprietary backend code without written authorization is strictly prohibited."
            }
        ]
    },
    refund: {
        id: "refund",
        title: "Refund Policy",
        lastUpdated: "August 7, 2026 (Previously revised: July 22, 2026)",
        sections: [
            {
                title: "1. Digital Service Sales & Immediate Provisioning",
                content: "XURL subscription upgrades, link package grants, and plan add-ons are digital cloud services that are provisioned immediately upon transaction confirmation. Because infrastructure capacity and Edge routing resources are reserved instantly, all transactions are generally final and non-refundable."
            },
            {
                title: "2. 7-Day Enterprise Technical Guarantee",
                content: "We offer a **7-day money-back guarantee** for first-time paid plan upgrades (Starter, Pro, Business, Enterprise) if the platform experiences persistent, unresolvable technical defects that prevent normal link shortening. Refund requests must be submitted to support within 7 calendar days of purchase."
            },
            {
                title: "3. Forfeiture of Refunds Upon Terms Violation",
                content: "Accounts that have been suspended or permanently banned due to violations of our Acceptable Use Policy (e.g., shortening phishing, malware, or spam links) **forfeit all eligibility for refunds or credit adjustments**."
            },
            {
                title: "4. Fraud Prevention & Unauthorized Chargebacks",
                content: "Initiating fraudulent payment chargebacks without first contacting XURL support will result in immediate perpetual lockout of the associated account, deletion of all active shortened links, and inclusion of payment details on our risk blocklist."
            }
        ]
    }
};
