import { describe, expect, test } from "bun:test";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import {
	createTurnZedToken,
	recordZedToken,
	zedTokenResponseMiddleware,
} from "./zed-token";

/** Runs the middleware around a handler that writes `zedTokens` through the Effect context. */
const run = async (params: {
	zedTokens?: (string | undefined)[];
	output: unknown;
	secureCookies?: boolean;
}) => {
	const resHeaders = new Headers();

	const result = await (
		zedTokenResponseMiddleware as unknown as (options: {
			context: unknown;
			next: (options: {
				context: {
					"effect/context": Context.Context<never>;
				};
			}) => Promise<{
				output: unknown;
				context: unknown;
			}>;
		}) => Promise<{
			output: unknown;
		}>
	)({
		context: {
			"effect/context": Context.empty(),
			resHeaders,
			secureCookies: params.secureCookies,
		},
		next: ({ context }) => {
			Effect.runSync(
				Effect.forEach(params.zedTokens ?? [], recordZedToken).pipe(
					Effect.provide(context["effect/context"]),
				),
			);

			return Promise.resolve({
				output: params.output,
				context: {},
			});
		},
	});

	return {
		output: result.output,
		setCookie: resHeaders.get("Set-Cookie"),
	};
};

describe("zedTokenResponseMiddleware", () => {
	test("adds the token to the output and the response cookie", async () => {
		const { output, setCookie } = await run({
			zedTokens: [
				"token-1",
			],
			output: {
				data: {
					id: "chat-1",
				},
			},
		});

		expect(output).toEqual({
			data: {
				id: "chat-1",
			},
			meta: {
				zedToken: "token-1",
			},
		});
		expect(setCookie).toContain("zed_token=token-1");
		expect(setCookie).toContain("Max-Age=60");
		expect(setCookie).toContain("Path=/");
		expect(setCookie).toContain("HttpOnly");
		expect(setCookie).toContain("SameSite=Lax");
		expect(setCookie).not.toContain("Secure");
	});

	test("keeps the other meta keys", async () => {
		const { output } = await run({
			zedTokens: [
				"token-2",
			],
			output: {
				data: [],
				meta: {
					page: 2,
				},
			},
		});

		expect(output).toEqual({
			data: [],
			meta: {
				page: 2,
				zedToken: "token-2",
			},
		});
	});

	test("leaves the output and the headers alone without a token", async () => {
		const output = {
			data: {
				id: "chat-1",
			},
		};
		const result = await run({
			output,
		});

		expect(result.output).toBe(output);
		expect(result.setCookie).toBeNull();
	});

	test("leaves outputs that are not plain objects alone", async () => {
		const stream = (function* () {
			yield 1;
		})();
		const result = await run({
			zedTokens: [
				"token-3",
			],
			output: stream,
		});

		expect(result.output).toBe(stream);
		expect(result.setCookie).toContain("zed_token=token-3");
	});

	test("publishes the last token written, ignoring writes without one", async () => {
		const { output } = await run({
			zedTokens: [
				"first",
				"second",
				undefined,
			],
			output: {
				data: null,
			},
		});

		expect(output).toEqual({
			data: null,
			meta: {
				zedToken: "second",
			},
		});
	});

	test("marks the cookie Secure over https", async () => {
		const { setCookie } = await run({
			zedTokens: [
				"token-4",
			],
			output: {
				data: null,
			},
			secureCookies: true,
		});

		expect(setCookie).toContain("Secure");
	});
});

describe("createTurnZedToken", () => {
	const save = (zedToken?: string) =>
		Effect.succeed({
			data: {},
			...(zedToken
				? {
						meta: {
							zedToken,
						},
					}
				: {}),
		});

	test("each call reads at the newest token of the turn", async () => {
		const turn = createTurnZedToken("request-token");
		const seen: (string | undefined)[] = [];
		const call = (written?: string) =>
			turn.run((zedToken) => {
				seen.push(zedToken);
				return save(written);
			});

		await Effect.runPromise(
			Effect.gen(function* () {
				yield* call("after-save");
				yield* call();
				yield* call();
			}),
		);

		expect(seen).toEqual([
			"request-token",
			"after-save",
			"after-save",
		]);
		expect(turn.current()).toBe("after-save");
	});

	test("concurrent calls run one at a time, so a slow write cannot roll the token back", async () => {
		const turn = createTurnZedToken("request-token");
		const seen: (string | undefined)[] = [];
		const slowSave = (written: string, delay: number) =>
			turn.run((zedToken) =>
				Effect.sync(() => seen.push(zedToken)).pipe(
					Effect.andThen(Effect.sleep(delay)),
					Effect.andThen(save(written)),
				),
			);

		await Effect.runPromise(
			Effect.all(
				[
					slowSave("first-save", 20),
					slowSave("second-save", 0),
				],
				{
					concurrency: "unbounded",
				},
			),
		);

		expect(seen).toEqual([
			"request-token",
			"first-save",
		]);
		expect(turn.current()).toBe("second-save");
	});
});
