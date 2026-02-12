import { decrypt, encrypt } from "@orpc/server/helpers";
import { serverEnv } from "@/lib/env/server";

function getEncryptionKey(): string {
	const encryptionKey = serverEnv.ENCRYPTION_KEY;
	if (!encryptionKey) {
		throw new Error("ENCRYPTION_KEY environment variable is not set");
	}

	return encryptionKey;
}

/**
 * Utility function to safely encrypt API keys
 * Validates that the input is not empty and returns encrypted result
 */
export async function encryptApiKey(apiKey: string): Promise<string> {
	if (!apiKey || apiKey.trim().length === 0) {
		throw new Error("API key cannot be empty");
	}

	try {
		return await encrypt(apiKey.trim(), getEncryptionKey());
	} catch (error) {
		throw new Error(
			`Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Utility function to safely decrypt API keys
 * Returns the decrypted API key or throws an error
 */
export async function decryptApiKey(encryptedApiKey: string): Promise<string> {
	if (!encryptedApiKey || encryptedApiKey.trim().length === 0) {
		throw new Error("Encrypted API key cannot be empty");
	}

	try {
		const decrypted = await decrypt(encryptedApiKey.trim(), getEncryptionKey());
		if (!decrypted) {
			throw new Error("Invalid encrypted API key or encryption key");
		}

		return decrypted;
	} catch (error) {
		throw new Error(
			`Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}
