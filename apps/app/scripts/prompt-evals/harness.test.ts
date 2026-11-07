import { describe, expect, test } from "bun:test";
import { generateText } from "ai";
import { FINAL_STEP_NOTE } from "@/lib/ai/agents/step-request";
import {
	describeError,
	evalModel,
	OPENROUTER,
	repository,
	runAssistant,
	runChat,
} from "./harness";

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

type ScriptedRequest = {
	messages: {
		role: string;
		content: unknown;
	}[];
	tools?: {
		function: {
			name: string;
		};
	}[];
	tool_choice?: unknown;
	max_tokens?: number;
};

/** One streamed completion: a tool call, or else the answer "Done.". */
const completion = (
	index: number,
	call:
		| {
				name: string;
				input: unknown;
		  }
		| undefined,
) => {
	const chunk = (choice: object, extra: object = {}) =>
		`data:${JSON.stringify({
			id: `response-${index}`,
			object: "chat.completion.chunk",
			created: 0,
			model: "scripted",
			choices: [
				{
					index: 0,
					...choice,
				},
			],
			...extra,
		})}\n\n`;
	const body = [
		chunk({
			delta: call
				? {
						role: "assistant",
						tool_calls: [
							{
								index: 0,
								id: `call-${index}`,
								type: "function",
								function: {
									name: call.name,
									arguments: JSON.stringify(call.input),
								},
							},
						],
					}
				: {
						role: "assistant",
						content: "Done.",
					},
			finish_reason: null,
		}),
		chunk({
			delta: {},
			finish_reason: call ? "tool_calls" : "stop",
		}),
		// OpenRouter reports usage in its own event after the finish.
		`data:${JSON.stringify({
			id: `response-${index}`,
			object: "chat.completion.chunk",
			created: 0,
			model: "scripted",
			choices: [],
			usage: {
				prompt_tokens: 1,
				completion_tokens: 1,
				total_tokens: 2,
				cost: 0.001,
			},
		})}\r\n\r\n`,
		"data: [DONE]\n\n",
	].join("");

	return new Response(body, {
		headers: {
			"content-type": "text/event-stream",
		},
	});
};

/** An OpenAI-compatible endpoint that answers each request with the next tool call, then with text. */
const scriptedEndpoint = (
	calls: (
		| {
				name: string;
				input: unknown;
		  }
		| ((request: ScriptedRequest) =>
				| {
						name: string;
						input: unknown;
				  }
				| undefined)
	)[],
	{
		url = "https://endpoint.test/v1",
		onCost = () => undefined,
	}: {
		url?: string;
		onCost?: (cost: number) => void;
	} = {},
) => {
	const requests: ScriptedRequest[] = [];
	const fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
		const request: ScriptedRequest = JSON.parse(String(init?.body));
		requests.push(request);
		const next = calls[requests.length - 1];
		return Promise.resolve(
			completion(
				requests.length,
				typeof next === "function" ? next(request) : next,
			),
		);
	}) as unknown as typeof globalThis.fetch;

	return {
		requests,
		model: evalModel(
			"scripted",
			{
				url,
				apiKey: KEY,
				fetch,
			},
			onCost,
		),
	};
};

const toolNames = (request: ScriptedRequest | undefined) =>
	request?.tools?.map(({ function: { name } }) => name);

describe("runChat", () => {
	test("runs a scripted call and ends on an unscripted one without running it", async () => {
		const { requests, model } = scriptedEndpoint([
			{
				name: "searchRepositories",
				input: {
					query: "essay deadline",
				},
			},
			{
				name: "listRepositoryAssets",
				input: {},
			},
		]);

		const transcript = await runChat({
			model,
			behaviour: undefined,
			repositories: [
				repository("Course"),
			],
			message: "When is the essay due?",
			scripted: {
				searchRepositories: () => ({
					results: [],
				}),
			},
		});

		expect(transcript.calls).toEqual([
			{
				toolName: "searchRepositories",
				input: {
					query: "essay deadline",
				},
				output: {
					results: [],
				},
			},
			{
				toolName: "listRepositoryAssets",
				input: {
					limit: 30,
				},
				output: undefined,
			},
		]);
		expect(transcript.stop).toBe("call to listRepositoryAssets");
		expect(requests).toHaveLength(2);
	});

	test("sends the turn's tools, output cap and last step without tools", async () => {
		let searches = 0;
		const { requests, model } = scriptedEndpoint(
			Array.from(
				{
					length: 25,
				},
				() => ({
					name: "searchWeb",
					input: {
						query: "essay deadline",
					},
				}),
			),
		);

		const transcript = await runChat({
			model,
			behaviour: undefined,
			repositories: [
				repository("Course"),
			],
			message: "When is the essay due?",
			webSearch: true,
			generativeUi: true,
			scripted: {
				searchWeb: () => {
					searches++;
					return {
						results: [],
					};
				},
			},
		});

		expect(toolNames(requests[0])?.at(0)).toBe("searchRepositories");
		expect(toolNames(requests[0])?.at(-1)).toBe("searchWeb");
		expect(toolNames(requests[0])).not.toContain("askUser");
		expect(requests[0].max_tokens).toBe(16_384);
		expect(requests).toHaveLength(25);
		const last = requests.at(-1);
		expect(last?.tool_choice).toBe("none");
		expect(JSON.stringify(last?.messages.at(-1))).toContain(FINAL_STEP_NOTE);
		expect(transcript.stop).toBe("step limit");
		expect(searches).toBe(24);
	});

	test("adds up the cost OpenRouter reports in each streamed response", async () => {
		const costs: number[] = [];
		const { model } = scriptedEndpoint(
			[
				{
					name: "searchRepositories",
					input: {
						query: "essay deadline",
					},
				},
			],
			{
				url: OPENROUTER,
				onCost: (cost) => costs.push(cost),
			},
		);

		await runChat({
			model,
			behaviour: undefined,
			repositories: [
				repository("Course"),
			],
			message: "When is the essay due?",
			scripted: {
				searchRepositories: () => ({
					results: [],
				}),
			},
		});

		expect(costs).toEqual([
			0.001,
			0.001,
		]);
	});
});

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
		expect(toolNames(afterApproval)).toContain("createBehaviour");
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
