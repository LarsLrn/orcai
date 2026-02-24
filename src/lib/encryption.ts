import { decrypt, encrypt } from "@orpc/server/helpers";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { AppConfigService } from "./effect/services/config";
import { InternalError } from "./effect/utils/errors";

/**
 * Utility function to safely encrypt API keys
 * Returns the encrypted result or typed error
 */
export const encryptApiKey = (apiKey: string) =>
	Effect.gen(function* () {
		if (!apiKey || apiKey.trim().length === 0) {
			return yield* new InternalError({
				operation: "encryptApiKey",
				cause: new Error("API key cannot be empty"),
			});
		}

		const { config } = yield* AppConfigService;

		return yield* Effect.tryPromise({
			try: () =>
				encrypt(apiKey.trim(), Redacted.value(config.app.encryptionKey)),
			catch: (cause) =>
				new InternalError({
					operation: "encryptApiKey",
					cause,
				}),
		});
	});

/**
 * Utility function to safely decrypt API keys
 * Returns the decrypted API key or typed error
 */
export const decryptApiKey = (encryptedApiKey: string) =>
	Effect.gen(function* () {
		if (!encryptedApiKey || encryptedApiKey.trim().length === 0) {
			return yield* new InternalError({
				operation: "decryptApiKey",
				cause: new Error("Encrypted API key cannot be empty"),
			});
		}

		const { config } = yield* AppConfigService;

		return yield* Effect.tryPromise({
			try: () =>
				decrypt(
					encryptedApiKey.trim(),
					Redacted.value(config.app.encryptionKey),
				),
			catch: (cause) =>
				new InternalError({
					operation: "decryptApiKey",
					cause,
				}),
		});
	});
