# Privacy Policy

**Effective Date:** March 13, 2026
**Last Updated:** March 13, 2026

XURL ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our URL shortening platform ("Service").

## 1. Information We Collect

### Information You Provide

- **Account Information** — When you sign in with Google, we receive your name, email address, and profile photo from your Google account.
- **Links and Content** — The URLs you submit for shortening and any custom aliases you create.
- **Payment Information** — When you purchase a paid plan, payment details are collected and processed by Razorpay. We receive transaction confirmations and order details but do not store your payment card information.

### Information Collected Automatically

- **Device Fingerprint** — A SHA-256 hashed browser fingerprint used for guest identification and abuse prevention. The raw fingerprint is never stored.
- **IP Address** — SHA-256 hashed and used for rate limiting, guest identification, and abuse detection. Raw IP addresses are not permanently stored.
- **Click Analytics** — When someone clicks a shortened link, we collect the referrer URL, user agent (browser and device type), approximate geographic location, and timestamp.
- **Usage Data** — Page views, feature usage, and interaction patterns used to improve the Service.

## 2. How We Use Your Information

We use the information we collect to:

- **Provide the Service** — Create and manage shortened URLs, process redirects, and enforce plan quotas.
- **Process Payments** — Complete paid plan purchases and maintain purchase history.
- **Prevent Abuse** — Enforce rate limits, detect malicious activity, block spam and phishing links, and protect the integrity of the platform.
- **Provide Analytics** — Generate click analytics, traffic breakdowns, and performance metrics for link creators.
- **Improve the Service** — Analyze usage patterns to improve features, performance, and user experience.
- **Communicate** — Send service-related notifications when necessary.

## 3. Cookies and Tracking

### Cookies

XURL uses essential cookies for:

- **Authentication** — Maintaining your signed-in session via Firebase Auth.
- **Session State** — Preserving UI preferences and guest link history in local storage.

We do not use third-party advertising cookies or tracking pixels.

### Local Storage

We store guest link history and UI state in your browser's local storage. This data remains on your device and is not transmitted to our servers.

## 4. Analytics

### Link Analytics

When someone clicks a shortened link created by you, we collect and aggregate click data including referrer, device type, browser, and country. This data is:

- Available to paid plan users through the analytics dashboard
- Aggregated into daily rollups (not stored as individual click events)
- Retained for 90 days, after which it is automatically pruned

### Service Analytics

We may use aggregated, anonymized data to monitor service health, detect abuse patterns, and improve performance. This data cannot be used to identify individual users.

## 5. Data Sharing

We do not sell, trade, or rent your personal information to third parties. We share data only with:

### Service Providers

- **Firebase (Google)** — Authentication, database storage, and cloud functions. Subject to [Google's Privacy Policy](https://policies.google.com/privacy).
- **Razorpay** — Payment processing for paid plans. Subject to [Razorpay's Privacy Policy](https://razorpay.com/privacy/).
- **Upstash** — Redis caching infrastructure. Caches contain URL mapping data and rate limiting state only.

### Legal Requirements

We may disclose information if required by law, regulation, legal process, or governmental request.

## 6. Data Retention

| Data Type | Retention Period |
| --- | --- |
| User account data | Until account deletion is requested |
| Shortened links | Until TTL expiry (plan-dependent: 5 min to 24 hours) |
| Guest usage records | Automatically deleted after TTL expiry |
| Click analytics | 90 days (pruned during maintenance) |
| Payment/transaction records | Retained for financial compliance |
| Hashed IP/fingerprint data | Cleared with associated guest usage records |

## 7. Your Rights

You have the right to:

- **Access** your personal data by viewing your profile and purchase history in the Service.
- **Correct** inaccurate information through the profile management page.
- **Delete** your account and associated data by contacting us.
- **Export** your link data through the Service interface.

To exercise any of these rights, please contact us through the information provided on our website.

## 8. Security Practices

We implement industry-standard security measures to protect your data:

- All data in transit is encrypted via HTTPS/TLS
- Sensitive identifiers (IP addresses, fingerprints) are SHA-256 hashed before storage
- Payment processing is handled by PCI-DSS compliant Razorpay
- Firebase Auth provides OAuth 2.0 authentication security
- Server-side token verification on every authenticated request
- Rate limiting and abuse detection across all public endpoints
- SSRF protection prevents malicious URL submission

No method of electronic storage or transmission is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.

## 9. Children's Privacy

The Service is not intended for use by individuals under the age of 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us so we can take appropriate action.

## 10. International Data Transfers

Your information may be processed and stored in jurisdictions outside your country of residence. By using the Service, you consent to the transfer of your information to these jurisdictions, which may have different data protection laws than your own.

## 11. Changes to This Policy

We may update this Privacy Policy from time to time. Material changes will be communicated through the Service. Your continued use of the Service after changes become effective constitutes acceptance of the revised policy. We encourage you to review this page periodically.

## 12. Contact

For questions or concerns about this Privacy Policy, please reach out through the contact information provided on our website.
