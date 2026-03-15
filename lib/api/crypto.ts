import crypto from "crypto";

const API_KEY_PREFIX = "xurl_sk_live_";

function getEncryptionSecret(): string {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
        throw new Error("Missing server secret for API key encryption.");
    }
    return secret;
}

function getEncryptionKey(): Buffer {
    return crypto.createHash("sha256").update(getEncryptionSecret()).digest();
}

export function generateApiKey(): string {
    return `${API_KEY_PREFIX}${crypto.randomBytes(24).toString("base64url")}`;
}

export function hashApiKey(apiKey: string): string {
    return crypto.createHash("sha256").update(apiKey).digest("hex");
}

export function encryptApiKey(apiKey: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString("base64url")}.${encrypted.toString("base64url")}.${authTag.toString("base64url")}`;
}

export function decryptApiKey(payload: string): string {
    const [ivPart, encryptedPart, authTagPart] = payload.split(".");
    if (!ivPart || !encryptedPart || !authTagPart) {
        throw new Error("Invalid encrypted API key payload.");
    }

    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        getEncryptionKey(),
        Buffer.from(ivPart, "base64url")
    );
    decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedPart, "base64url")),
        decipher.final(),
    ]);

    return decrypted.toString("utf8");
}
