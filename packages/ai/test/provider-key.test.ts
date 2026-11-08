import { afterEach, describe, expect, spyOn, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Redacted from "effect/Redacted";
import * as TestClock from "effect/testing/TestClock";
import {
	decryptApiKey,
	EncryptionKey,
	encryptApiKey,
	makeEncryptionKey,
} from "../src/provider-key";

const SECRET = "0123456789abcdef0123456789abcdef";

const withKey =
	(secret = SECRET) =>
	<A, E, R>(effect: Effect.Effect<A, E, R>) =>
		effect.pipe(
			Effect.provideServiceEffect(
				EncryptionKey,
				makeEncryptionKey(Redacted.make(secret)),
			),
		);

const run = <A, E>(effect: Effect.Effect<A, E, EncryptionKey>) =>
	Effect.runPromise(effect.pipe(withKey()));

/** Counts the AES decryptions, each of which follows a key derivation. */
const decryptions = () => spyOn(crypto.subtle, "decrypt");

/** Holds every decryption until `release`; `started` settles once the first begins. */
const heldDecryptions = () => {
	const decrypt = crypto.subtle.decrypt.bind(crypto.subtle);
	const started = Promise.withResolvers<void>();
	const released = Promise.withResolvers<void>();
	const spy = spyOn(crypto.subtle, "decrypt").mockImplementation(
		async (...args: Parameters<typeof decrypt>) => {
			started.resolve();
			await released.promise;
			return decrypt(...args);
		},
	);
	return {
		spy,
		started: Effect.promise(() => started.promise),
		release: Effect.sync(() => released.resolve()),
	};
};

afterEach(() => {
	(
		crypto.subtle.decrypt as unknown as {
			mockRestore?: () => void;
		}
	).mockRestore?.();
});

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
					withKey("another-secret-another-secret-32"),
				),
			),
		);
		expect(error._tag).toBe("AiError");
	});
});

describe("decrypted keys", () => {
	test("decrypt a stored key once, however often and concurrently it is read", async () => {
		const encrypted = await run(encryptApiKey("sk-provider-key"));
		const spy = decryptions();

		const keys = await run(
			Effect.gen(function* () {
				const together = yield* Effect.all(
					[
						decryptApiKey(encrypted),
						decryptApiKey(encrypted),
						decryptApiKey(` ${encrypted} `),
					],
					{
						concurrency: "unbounded",
					},
				);
				return [
					...together,
					yield* decryptApiKey(encrypted),
				];
			}),
		);

		expect(keys).toEqual([
			"sk-provider-key",
			"sk-provider-key",
			"sk-provider-key",
			"sk-provider-key",
		]);
		expect(spy).toHaveBeenCalledTimes(1);
	});

	test("decrypt again after 15 minutes", async () => {
		const encrypted = await run(encryptApiKey("sk-provider-key"));
		const spy = decryptions();

		await Effect.runPromise(
			Effect.gen(function* () {
				yield* decryptApiKey(encrypted);
				yield* TestClock.adjust("14 minutes");
				yield* decryptApiKey(encrypted);
				expect(spy).toHaveBeenCalledTimes(1);
				yield* TestClock.adjust("2 minutes");
				yield* decryptApiKey(encrypted);
			}).pipe(withKey(), Effect.provide(TestClock.layer())),
		);

		expect(spy).toHaveBeenCalledTimes(2);
	});

	test("keep no failure: a failed decryption runs again", async () => {
		const spy = decryptions();

		await run(
			Effect.gen(function* () {
				yield* Effect.flip(decryptApiKey("not-a-stored-key-not-a-stored-key"));
				yield* Effect.flip(decryptApiKey("not-a-stored-key-not-a-stored-key"));
			}),
		);

		expect(spy).toHaveBeenCalledTimes(2);
	});

	test("are kept per encryption key: another key decrypts nothing from them", async () => {
		const encrypted = await run(encryptApiKey("sk-provider-key"));
		const other = await Effect.runPromise(
			makeEncryptionKey(Redacted.make("another-secret-another-secret-32")),
		);

		const result = await run(
			Effect.gen(function* () {
				const decrypted = yield* decryptApiKey(encrypted);
				const elsewhere = yield* Effect.flip(
					decryptApiKey(encrypted).pipe(
						Effect.provideService(EncryptionKey, other),
					),
				);
				return [
					decrypted,
					elsewhere._tag,
				];
			}),
		);

		expect(result).toEqual([
			"sk-provider-key",
			"AiError",
		]);
	});

	test("serve a reader whose fellow reader of the same key was interrupted", async () => {
		const encrypted = await run(encryptApiKey("sk-provider-key"));
		const held = heldDecryptions();

		const survivor = await run(
			Effect.gen(function* () {
				const interrupted = yield* Effect.forkChild(decryptApiKey(encrypted));
				const waiting = yield* Effect.forkChild(decryptApiKey(encrypted));
				yield* held.started;
				yield* Fiber.interrupt(interrupted);
				yield* held.release;
				return yield* Fiber.join(waiting);
			}),
		);

		expect(survivor).toBe("sk-provider-key");
	});

	test("decrypt for a later reader once every reader of a pending decryption was interrupted", async () => {
		const encrypted = await run(encryptApiKey("sk-provider-key"));
		const held = heldDecryptions();

		const later = await run(
			Effect.gen(function* () {
				const readers = yield* Effect.forEach(
					[
						1,
						2,
					],
					() => Effect.forkChild(decryptApiKey(encrypted)),
				);
				yield* held.started;
				yield* Fiber.interruptAll(readers);
				yield* held.release;
				return yield* decryptApiKey(encrypted);
			}),
		);

		expect(later).toBe("sk-provider-key");
	});
});
