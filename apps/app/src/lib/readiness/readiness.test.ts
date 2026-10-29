import { describe, expect, test } from "bun:test";
import type { GroupId, ModelId, ProviderId } from "@orcai/core";
import {
	chatPoolGroupIds,
	evaluateReadiness,
	type ReadinessSnapshot,
} from "./readiness";

const provider = "provider-1" as ProviderId;
const search = "provider-search" as ProviderId;
const chat = "model-chat" as ModelId;
const textOnly = "model-text" as ModelId;
const allMembers = "group-all" as GroupId;
const staff = "group-staff" as GroupId;

type Model = ReadinessSnapshot["models"][number];

const chatModel: Model = {
	id: chat,
	providerId: provider,
	capabilities: [
		"text",
		"tool-calling",
	],
	isDeprecated: false,
};

const textModel: Model = {
	id: textOnly,
	providerId: provider,
	capabilities: [
		"text",
	],
	isDeprecated: false,
};

/** An organisation where everything is set up. */
const ready: ReadinessSnapshot = {
	providers: [
		{
			id: provider,
			kind: "openai-compatible",
			enabled: true,
		},
	],
	models: [
		chatModel,
		textModel,
	],
	pools: [
		{
			providerId: provider,
			modelId: null,
			groupIds: [
				allMembers,
			],
		},
	],
	assistantModelId: chat,
	utilityModelId: textOnly,
	memberCount: 2,
	pendingInvitations: 0,
};

const statusOf = (snapshot: ReadinessSnapshot, uncoveredMembers = 0) =>
	Object.fromEntries(
		evaluateReadiness(snapshot, uncoveredMembers).checks.map((check) => [
			check.id,
			check.status,
		]),
	);

const checkOf = (
	snapshot: ReadinessSnapshot,
	id: string,
	uncoveredMembers = 0,
) =>
	evaluateReadiness(snapshot, uncoveredMembers).checks.find(
		(check) => check.id === id,
	);

describe("evaluateReadiness", () => {
	test("passes every check when the organisation is set up", () => {
		expect(statusOf(ready)).toEqual({
			provider: "ok",
			"chat-model": "ok",
			pool: "ok",
			"assistant-model": "ok",
			"assistant-pool": "ok",
			"utility-model": "ok",
			members: "ok",
			coverage: "ok",
		});
	});

	test("fails every required check for a fresh organisation", () => {
		const fresh: ReadinessSnapshot = {
			providers: [],
			models: [],
			pools: [],
			assistantModelId: null,
			utilityModelId: null,
			memberCount: 1,
			pendingInvitations: 0,
		};
		expect(statusOf(fresh, 1)).toEqual({
			provider: "failing",
			"chat-model": "failing",
			pool: "failing",
			"assistant-model": "failing",
			"assistant-pool": "failing",
			"utility-model": "warning",
			members: "warning",
			coverage: "warning",
		});
		expect(checkOf(fresh, "assistant-model", 1)?.reason).toBe(
			"ASSISTANT_MODEL_MISSING",
		);
	});

	test("ignores search providers and disabled providers", () => {
		const snapshot: ReadinessSnapshot = {
			...ready,
			providers: [
				{
					id: provider,
					kind: "openai-compatible",
					enabled: false,
				},
				{
					id: search,
					kind: "tavily",
					enabled: true,
				},
			],
		};
		expect(statusOf(snapshot)).toMatchObject({
			provider: "failing",
			"chat-model": "failing",
			pool: "failing",
			"assistant-model": "failing",
			"assistant-pool": "failing",
		});
		expect(checkOf(snapshot, "assistant-model")?.reason).toBe(
			"ASSISTANT_MODEL_UNUSABLE",
		);
	});

	test("applies the turn rule to models: tool calling, not deprecated", () => {
		const withoutTools: ReadinessSnapshot = {
			...ready,
			models: ready.models.map((model) => ({
				...model,
				capabilities: [
					"text",
				],
			})),
		};
		expect(statusOf(withoutTools)["chat-model"]).toBe("failing");

		const deprecated: ReadinessSnapshot = {
			...ready,
			models: ready.models.map((model) =>
				model.id === chat
					? {
							...model,
							isDeprecated: true,
						}
					: model,
			),
		};
		expect(statusOf(deprecated)).toMatchObject({
			"chat-model": "failing",
			"assistant-model": "failing",
		});
	});

	test("asks for capabilities when only models without them could chat", () => {
		const unset = (model: Model) => ({
			...model,
			capabilities: null,
		});
		const discovered: ReadinessSnapshot = {
			...ready,
			models: [
				...ready.models.map(unset),
				{
					...unset(chatModel),
					id: "model-old" as ModelId,
					isDeprecated: true,
				},
			],
		};

		expect(checkOf(discovered, "chat-model")).toMatchObject({
			status: "failing",
			reason: "CHAT_MODEL_CAPABILITIES_UNKNOWN",
			params: {
				count: 2,
			},
		});
		expect(
			checkOf(
				{
					...discovered,
					models: [
						...discovered.models,
						chatModel,
					],
				},
				"chat-model",
			),
		).toEqual({
			id: "chat-model",
			severity: "required",
			status: "ok",
			reason: "CHAT_MODEL_READY",
		});
		expect(
			checkOf(
				{
					...ready,
					models: [
						{
							...textModel,
							capabilities: [],
						},
					],
				},
				"chat-model",
			),
		).toEqual({
			id: "chat-model",
			severity: "required",
			status: "failing",
			reason: "CHAT_MODEL_MISSING",
		});
	});

	test("needs a pool assigned to a group that covers a chat-ready model", () => {
		expect(
			statusOf({
				...ready,
				pools: [
					{
						providerId: provider,
						modelId: null,
						groupIds: [],
					},
				],
			}).pool,
		).toBe("failing");
		expect(
			statusOf({
				...ready,
				pools: [
					{
						providerId: provider,
						modelId: textOnly,
						groupIds: [
							allMembers,
						],
					},
				],
			}),
		).toMatchObject({
			pool: "failing",
			"assistant-pool": "failing",
		});
	});

	test("needs a pool that covers the assistant model itself", () => {
		const other = "model-other" as ModelId;
		expect(
			statusOf({
				...ready,
				models: [
					...ready.models,
					{
						id: other,
						providerId: provider,
						capabilities: [
							"tool-calling",
						],
						isDeprecated: false,
					},
				],
				pools: [
					{
						providerId: provider,
						modelId: other,
						groupIds: [
							allMembers,
						],
					},
				],
			}),
		).toMatchObject({
			pool: "ok",
			"assistant-pool": "failing",
		});
	});

	test("reaches members only through groups of pools that cover a chat model", () => {
		expect(
			chatPoolGroupIds({
				...ready,
				pools: [
					{
						providerId: provider,
						modelId: null,
						groupIds: [
							staff,
						],
					},
					{
						providerId: provider,
						modelId: textOnly,
						groupIds: [
							allMembers,
						],
					},
				],
			}),
		).toEqual([
			staff,
		]);
		expect(checkOf(ready, "coverage", 1)).toMatchObject({
			status: "warning",
			reason: "COVERAGE_GAPS",
			params: {
				count: 1,
			},
		});
		expect(checkOf(ready, "coverage")?.params).toEqual({
			count: 0,
		});
	});

	test("counts a pending invitation as inviting beyond the admin", () => {
		const alone: ReadinessSnapshot = {
			...ready,
			memberCount: 1,
		};
		expect(statusOf(alone).members).toBe("warning");
		expect(
			statusOf({
				...alone,
				pendingInvitations: 1,
			}).members,
		).toBe("ok");
	});
});
