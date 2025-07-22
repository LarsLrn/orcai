import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // For AES, this is always 16
const SALT_LENGTH = 32; // For key derivation
const TAG_LENGTH = 16; // For GCM authentication tag

/**
 * Derives a key from the ENCRYPTION_KEY environment variable using PBKDF2
 */
function deriveKey(salt: Buffer): Buffer {
	const encryptionKey = process.env.ENCRYPTION_KEY;
	if (!encryptionKey) {
		throw new Error("ENCRYPTION_KEY environment variable is not set");
	}

	// Use PBKDF2 to derive a 256-bit key from the environment variable
	return crypto.pbkdf2Sync(encryptionKey, salt, 100000, 32, "sha512");
}

/**
 * Encrypts a plain text string using AES-256-GCM
 * Returns a base64-encoded string containing salt:iv:tag:encrypted_data
 */
export function encrypt(plaintext: string): string {
	try {
		// Generate random salt and IV
		const salt = crypto.randomBytes(SALT_LENGTH);
		const iv = crypto.randomBytes(IV_LENGTH);

		// Derive key from the environment variable
		const key = deriveKey(salt);

		// Create cipher
		const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

		// Encrypt the data
		let encrypted = cipher.update(plaintext, "utf8", "hex");
		encrypted += cipher.final("hex");

		// Get the authentication tag
		const tag = cipher.getAuthTag();

		// Combine salt, iv, tag, and encrypted data
		const combined = Buffer.concat([
			salt,
			iv,
			tag,
			Buffer.from(encrypted, "hex"),
		]);

		return combined.toString("base64");
	} catch (error) {
		throw new Error(
			`Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Decrypts a base64-encoded encrypted string
 * Expected format: salt:iv:tag:encrypted_data
 */
export function decrypt(encryptedData: string): string {
	try {
		// Decode from base64
		const combined = Buffer.from(encryptedData, "base64");

		// Extract components
		const salt = combined.subarray(0, SALT_LENGTH);
		const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
		const tag = combined.subarray(
			SALT_LENGTH + IV_LENGTH,
			SALT_LENGTH + IV_LENGTH + TAG_LENGTH,
		);
		const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

		// Derive key from the environment variable
		const key = deriveKey(salt);

		// Create decipher
		const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(tag);

		// Decrypt the data
		let decrypted = decipher.update(encrypted, undefined, "utf8");
		decrypted += decipher.final("utf8");

		return decrypted;
	} catch (error) {
		throw new Error(
			`Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Utility function to safely encrypt API keys
 * Validates that the input is not empty and returns encrypted result
 */
export function encryptApiKey(apiKey: string): string {
	if (!apiKey || apiKey.trim().length === 0) {
		throw new Error("API key cannot be empty");
	}

	return encrypt(apiKey.trim());
}

/**
 * Utility function to safely decrypt API keys
 * Returns the decrypted API key or throws an error
 */
export function decryptApiKey(encryptedApiKey: string): string {
	if (!encryptedApiKey || encryptedApiKey.trim().length === 0) {
		throw new Error("Encrypted API key cannot be empty");
	}

	return decrypt(encryptedApiKey.trim());
}
