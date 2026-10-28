import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import {
	decryptApiKey,
	EncryptionKey,
	encryptApiKey,
} from "../src/provider-key";

const SECRET = "0123456789abcdef0123456789abcdef";

const run = <A, E>(effect: Effect.Effect<A, E, EncryptionKey>) =>
	Effect.runPromise(
		effect.pipe(Effect.provideService(EncryptionKey, Redacted.make(SECRET))),
	);

describe("provider API keys", () => {
	test("decrypt what they encrypt, with a fresh salt each time", async () => {
		const first = await run(encryptApiKey(" sk-provider-key "));
		const second = await run(encryptApiKey("sk-provider-key"));

		expect(first).not.toBe(second);
		expect(await run(decryptApiKey(first))).toBe("sk-provider-key");
	});

	test("decrypt keys stored before, in the same format", async () => {
		expect(
			await run(
				decryptApiKey(
					"L7AL4rpAe37kyVsAN0GHYiEr8xUPKQxzw8j-DxAmH10rF0DrrMsrdzP5RGolaTJJmsv7e1w3jzqYPkh4pEaonw",
				),
			),
		).toBe("sk-test-provider-key");
	});

	test("fail as an AiError with another key", async () => {
		const encrypted = await run(encryptApiKey("sk-provider-key"));

		const error = await Effect.runPromise(
			Effect.flip(
				decryptApiKey(encrypted).pipe(
					Effect.provideService(
						EncryptionKey,
						Redacted.make("another-secret-another-secret-32"),
					),
				),
			),
		);
		expect(error._tag).toBe("AiError");
	});
});
