import { describe, expect, test } from "bun:test";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { recordZedToken } from "@/lib/authz/zed-token";
import { zedTokenResponseMiddleware } from "./zed-token";

const run = async (params: {
	writes?: Parameters<typeof recordZedToken>[];
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
				Effect.forEach(params.writes ?? [], (write) =>
					recordZedToken(...write),
				).pipe(Effect.provide(context["effect/context"])),
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
			writes: [
				[
					"token-1",
				],
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
			writes: [
				[
					"token-2",
				],
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
			writes: [
				[
					"token-3",
				],
			],
			output: stream,
		});

		expect(result.output).toBe(stream);
		expect(result.setCookie).toContain("zed_token=token-3");
	});

	test("publishes the last token written, ignoring writes without one", async () => {
		const { output } = await run({
			writes: [
				[
					"first",
				],
				[
					"second",
				],
				[
					undefined,
				],
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

	test("publishes the newest outbox event's token, whatever order deliveries finish in", async () => {
		const { output } = await run({
			writes: [
				[
					"seq-7",
					7,
				],
				[
					"seq-9",
					9,
				],
				[
					"seq-8",
					8,
				],
			],
			output: {
				data: null,
			},
		});

		expect(output).toEqual({
			data: null,
			meta: {
				zedToken: "seq-9",
			},
		});
	});

	test("marks the cookie Secure over https", async () => {
		const { setCookie } = await run({
			writes: [
				[
					"token-4",
				],
			],
			output: {
				data: null,
			},
			secureCookies: true,
		});

		expect(setCookie).toContain("Secure");
	});
});
