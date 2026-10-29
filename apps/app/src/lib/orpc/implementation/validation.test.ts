import { describe, expect, test } from "bun:test";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { onError, os } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { z } from "zod/v4";
import { describeValidationFailure, errorStatusMap } from "./validation";

const router = {
	echo: os
		.input(
			z.object({
				name: z.string().max(3),
			}),
		)
		.output(
			z.object({
				name: z.string().max(3),
			}),
		)
		.handler(({ input }) => ({
			name: input.name === "bad" ? "too long" : input.name,
		})),
};

const handlers = [
	{
		name: "rpc",
		handler: new RPCHandler(router, {
			clientInterceptors: [
				onError(describeValidationFailure),
			],
			errorStatusMap,
		}),
		body: (name: string) =>
			JSON.stringify({
				json: {
					name,
				},
			}),
	},
	{
		name: "openapi",
		handler: new OpenAPIHandler(router, {
			clientInterceptors: [
				onError(describeValidationFailure),
			],
			errorStatusMap,
		}),
		body: (name: string) =>
			JSON.stringify({
				name,
			}),
	},
];

describe.each(handlers)("$name handler", ({ handler, body }) => {
	const echo = async (name: string) => {
		const { response } = await handler.handle(
			new Request("http://localhost/echo", {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: body(name),
			}),
			{
				context: {},
			},
		);
		if (!response) throw new Error("no procedure matched");
		const text = await response.text();
		return {
			status: response.status,
			text,
		};
	};

	test("answers a rejected input with 400 and the failing field", async () => {
		const { status, text } = await echo("long");

		expect(status).toBe(400);
		expect(text).toContain("INPUT_VALIDATION_FAILED");
		expect(text).toContain("name");
	});

	test("answers a rejected output with 500", async () => {
		const { status, text } = await echo("bad");

		expect(status).toBe(500);
		expect(text).toContain("OUTPUT_VALIDATION_FAILED");
	});

	test("answers a valid call with 200", async () => {
		expect((await echo("ok")).status).toBe(200);
	});
});
