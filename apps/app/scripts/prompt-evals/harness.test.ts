import { describe, expect, test } from "bun:test";
import { generateText } from "ai";
import { describeError, evalModel } from "./harness";

const KEY = "sk-secret-key-123";

describe("describeError", () => {
	test("keeps the endpoint's key out of a provider's authentication error", async () => {
		const model = evalModel(
			"any-model",
			{
				url: "https://endpoint.test/v1",
				apiKey: KEY,
				fetch: (async () =>
					new Response(
						JSON.stringify({
							error: {
								message: `Incorrect API key provided: ${KEY}`,
							},
						}),
						{
							status: 401,
						},
					)) as unknown as typeof globalThis.fetch,
			},
			() => undefined,
		);

		const error = await generateText({
			model: model.model.language,
			prompt: "hi",
		}).catch((caught: unknown) => caught);
		const described = describeError(error, KEY);

		expect(error).toBeInstanceOf(Error);
		expect(JSON.stringify(error)).toContain(KEY);
		expect(described.message).toContain("[redacted]");
		expect(JSON.stringify(described)).not.toContain(KEY);
	});
});
