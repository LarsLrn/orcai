import type { ProviderId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { eq } from "drizzle-orm";
import * as Cache from "effect/Cache";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { AiError } from "./errors";

// Salt, IV and AES-GCM ciphertext, base64url: keys stored so far use this layout.
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

const deriveKey = (
	secret: string,
	salt: Uint8Array<ArrayBuffer>,
	usage: "encrypt" | "decrypt",
) =>
	crypto.subtle
		.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, [
			"deriveKey",
		])
		.then((material) =>
			crypto.subtle.deriveKey(
				{
					name: "PBKDF2",
					salt,
					iterations: 60_000,
					hash: "SHA-256",
				},
				material,
				{
					name: "AES-GCM",
					length: 256,
				},
				false,
				[
					usage,
				],
			),
		);

const encrypt = async (value: string, secret: string) => {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
	const encrypted = await crypto.subtle.encrypt(
		{
			name: "AES-GCM",
			iv,
		},
		await deriveKey(secret, salt, "encrypt"),
		new TextEncoder().encode(value),
	);
	return Buffer.concat([
		salt,
		iv,
		new Uint8Array(encrypted),
	]).toString("base64url");
};

const decrypt = async (encrypted: string, secret: string) => {
	const data = new Uint8Array(Buffer.from(encrypted, "base64url"));
	const decrypted = await crypto.subtle.decrypt(
		{
			name: "AES-GCM",
			iv: data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH),
		},
		await deriveKey(secret, data.subarray(0, SALT_LENGTH), "decrypt"),
		data.subarray(SALT_LENGTH + IV_LENGTH),
	);
	return new TextDecoder().decode(decrypted);
};

const keyError = (operation: string, message: string) =>
	new AiError({
		operation,
		cause: new Error(message),
	});

/** The key provider API keys are stored encrypted with, and the keys it decrypted lately. */
export class EncryptionKey extends Context.Service<
	EncryptionKey,
	{
		readonly secret: Redacted.Redacted<string>;
		readonly decrypted: Cache.Cache<string, string, AiError>;
	}
>()("EncryptionKey") {}

/**
 * `secret` as the encryption key. Each decryption derives a key, so up to
 * 256 decrypted keys are kept for 15 minutes; concurrent decryptions of one
 * stored key share one derivation, and a failure is not kept.
 */
export const makeEncryptionKey = (secret: Redacted.Redacted<string>) =>
	Cache.makeWith(
		(encrypted: string) =>
			Effect.tryPromise({
				try: () => decrypt(encrypted, Redacted.value(secret)),
				catch: (cause) =>
					new AiError({
						operation: "decryptApiKey",
						cause,
					}),
			}),
		{
			capacity: 256,
			timeToLive: (exit) => (Exit.isSuccess(exit) ? "15 minutes" : 0),
		},
	).pipe(
		Effect.map((decrypted) =>
			EncryptionKey.of({
				secret,
				decrypted,
			}),
		),
	);

export const EncryptionKeyLive = Layer.effect(
	EncryptionKey,
	Config.Redacted("ENCRYPTION_KEY").pipe(Effect.flatMap(makeEncryptionKey)),
);

/** A provider API key as stored. */
export const encryptApiKey = (apiKey: string) =>
	Effect.gen(function* () {
		if (apiKey.trim().length === 0) {
			return yield* keyError("encryptApiKey", "API key cannot be empty");
		}

		const { secret } = yield* EncryptionKey;

		return yield* Effect.tryPromise({
			try: () => encrypt(apiKey.trim(), Redacted.value(secret)),
			catch: (cause) =>
				new AiError({
					operation: "encryptApiKey",
					cause,
				}),
		});
	});

/** A stored provider API key, decrypted. */
export const decryptApiKey = (encrypted: string) =>
	EncryptionKey.pipe(
		Effect.flatMap(({ decrypted }) => Cache.get(decrypted, encrypted.trim())),
	);

/** The decrypted API key of a provider. */
export const providerApiKey = (providerId: ProviderId) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const [provider] = yield* db
			.select({
				apiKeyEncrypted: dbSchema.provider.apiKeyEncrypted,
			})
			.from(dbSchema.provider)
			.where(eq(dbSchema.provider.id, providerId))
			.limit(1)
			.pipe(
				Effect.mapError(
					(cause) =>
						new AiError({
							operation: "providerApiKey",
							cause,
						}),
				),
			);

		if (!provider || provider.apiKeyEncrypted.trim().length === 0) {
			return yield* keyError("providerApiKey", "Provider has no API key");
		}

		return yield* decryptApiKey(provider.apiKeyEncrypted);
	});
