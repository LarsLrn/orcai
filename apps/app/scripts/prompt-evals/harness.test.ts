import { describe, expect, test } from "bun:test";
import { generateText } from "ai";
import { describeError, evalModel, runAssistant } from "./harness";

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

/** An OpenAI-compatible endpoint that answers each request with the next tool call. */
const scriptedEndpoint = (
	calls: {
		name: string;
		input: unknown;
	}[],
) => {
	const requests: {
		messages: {
			role: string;
			content: unknown;
		}[];
		tools?: {
			function: {
				name: string;
			};
		}[];
	}[] = [];
	const fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
		requests.push(JSON.parse(String(init?.body)));
		const call = calls[requests.length - 1];
		return Response.json({
			id: `response-${requests.length}`,
			object: "chat.completion",
			created: 0,
			model: "scripted",
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: call ? null : "Done.",
						tool_calls: call && [
							{
								id: `call-${requests.length}`,
								type: "function",
								function: {
									name: call.name,
									arguments: JSON.stringify(call.input),
								},
							},
						],
					},
					finish_reason: call ? "tool_calls" : "stop",
				},
			],
			usage: {
				prompt_tokens: 1,
				completion_tokens: 1,
				total_tokens: 2,
			},
		});
	}) as unknown as typeof globalThis.fetch;

	return {
		requests,
		model: evalModel(
			"scripted",
			{
				url: "https://endpoint.test/v1",
				apiKey: KEY,
				fetch,
			},
			() => undefined,
		),
	};
};

const plan = {
	title: "Create Spanish drill",
	items: [
		{
			label: "Create the behaviour",
			status: "pending",
		},
	],
};

describe("runAssistant", () => {
	test("answers the questions, approves the plan and runs on in one session", async () => {
		const { requests, model } = scriptedEndpoint([
			{
				name: "askUser",
				input: {
					mode: "regular",
					questions: [
						{
							type: "single",
							prompt: "Which class?",
							options: [
								"Year 9",
								"Year 10",
							],
						},
						{
							type: "text",
							prompt: "What should it be called?",
						},
					],
				},
			},
			{
				name: "loadTools",
				input: {
					groups: [
						"bots",
					],
				},
			},
			{
				name: "updatePlan",
				input: plan,
			},
			{
				name: "createBehaviour",
				input: {
					name: "Spanish drill",
					systemPrompt: "# Role\nQuiz year 9 on Spanish words.",
				},
			},
		]);

		const transcript = await runAssistant({
			model,
			message: "Create a bot for Spanish vocabulary.",
			replies: [
				{
					answers: ({ questions }) => ({
						status: "answered",
						answers: questions.map((question) =>
							question.type === "text"
								? {
										type: "text",
										text: "Spanish drill",
									}
								: {
										type: "choice",
										choices: [
											0,
										],
									},
						),
					}),
				},
				{
					approve: true,
				},
			],
		});

		expect(transcript.calls.map(({ toolName }) => toolName)).toEqual([
			"askUser",
			"loadTools",
			"updatePlan",
			"createBehaviour",
		]);
		expect(transcript.stop).toBe("call to createBehaviour");
		expect(JSON.stringify(requests[1].messages.at(-1))).toContain("Year 9");
		expect(JSON.stringify(requests[1].messages.at(-1))).toContain(
			"Spanish drill",
		);
		const afterApproval = requests[3];
		expect(JSON.stringify(afterApproval.messages[0])).toContain(
			"Create Spanish drill",
		);
		expect(JSON.stringify(afterApproval.messages.at(-1))).toContain(
			'\\"approved\\":true',
		);
		expect(
			afterApproval.tools?.map(({ function: { name } }) => name),
		).toContain("createBehaviour");
	});

	test("ends where a reply does not fit the pause", async () => {
		const { requests, model } = scriptedEndpoint([
			{
				name: "updatePlan",
				input: plan,
			},
		]);

		const transcript = await runAssistant({
			model,
			message: "Create a bot for Spanish vocabulary.",
			replies: [
				{
					message: "Thanks.",
				},
			],
		});

		expect(requests).toHaveLength(1);
		expect(transcript.stop).toBe("call to updatePlan");
	});
});
