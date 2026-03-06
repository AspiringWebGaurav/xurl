# Firestore TTL Setup

XURL uses Firestore's native Time-to-Live (TTL) feature to automatically delete expired links and guest usage records.

**No manual configuration is needed in the Firebase Console.** TTL policies are defined natively within `firestore.indexes.json`.

## Deploy TTL Policies

You can authorize and deploy these policies via the standard Firebase CLI. Run the following command from the project root:

```bash
npm run deploy:ttl
```
*(This is a shortcut for `firebase deploy --only firestore:indexes`)*

### What happens

- The Firebase CLI will read the `fieldOverrides` array in `firestore.indexes.json`.
- It will enable TTL on the `links.expiresAt` and `guest_usage.expiresAt` fields.
- Firestore monitors the `expiresAt` timestamp field on each document and automatically deletes the document once the current time passes `expiresAt`.
- Deletion typically happens within minutes of expiry, but may take up to 72 hours on first activation.
- No cron jobs or manual cleanup are required.

### Requirements
- You must have the Firebase CLI installed (`npm install -g firebase-tools`).
- You must be authenticated with a Google account that has permission to modify Firestore settings on the deployment project (`firebase login`).