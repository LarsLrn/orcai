import { afterEach, describe, expect, mock, test } from "bun:test";
import type { BotId, ModelId, ProviderId, QuotaPoolId } from "@orcai/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

const quotaKey = (options: { input: unknown }) => [
	"quota.status",
	options.input,
];

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	orpc: {
		quota: {
			status: {
				queryKey: quotaKey,
				queryOptions: (options: { input: unknown }) => ({
					queryKey: quotaKey(options),
					queryFn: () => Promise.reject(new Error("No server in unit tests")),
				}),
			},
		},
	},
}));
const assistantModel = {
	providerId: crypto.randomUUID() as ProviderId,
	modelId: crypto.randomUUID() as ModelId,
};
mock.module("@/components/assistant/use-assistant-model", () => ({
	useAssistantModel: () => assistantModel,
}));

const { useComposerSendState } = await import("./use-composer-send-state");

afterEach(cleanup);

const providerId = crypto.randomUUID() as ProviderId;
const modelId = crypto.randomUUID() as ModelId;

const chatOf = (
	overrides: {
		botId?: BotId | null;
		readOnly?: unknown;
		model?: {
			providerId: ProviderId | null;
			modelId: ModelId | null;
		};
	} = {},
) => ({
	botId: overrides.botId ?? null,
	readOnly: overrides.readOnly ?? null,
	effectiveModel: {
		source: "chat" as const,
		...(overrides.model ?? {
			providerId,
			modelId,
		}),
	},
});
type TestChat = ReturnType<typeof chatOf>;

const pool = (usedShare: number) => ({
	available: true,
	pool: {
		id: crypto.randomUUID() as QuotaPoolId,
		name: "Everyone",
		usedShare,
		periodEndsAt: new Date(Date.now() + 60_000),
	},
});

const withQuota = (
	quota: unknown,
	model: {
		providerId: ProviderId;
		modelId: ModelId;
	} = {
		providerId,
		modelId,
	},
) => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: Number.POSITIVE_INFINITY,
			},
		},
	});
	if (quota) {
		queryClient.setQueryData(
			quotaKey({
				input: model,
			}),
			{
				data: quota,
			},
		);
	}
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
};

const sendState = (
	chat: TestChat,
	quota?: unknown,
	{
		kind = "chat",
		quotaModel,
	}: {
		kind?: "chat" | "assistant";
		quotaModel?: typeof assistantModel;
	} = {},
) =>
	renderHook(
		() =>
			useComposerSendState({
				chat: chat as never,
				kind,
			}),
		{
			wrapper: withQuota(quota, quotaModel),
		},
	).result.current;

describe("useComposerSendState", () => {
	test("a covered pool with room can send", () => {
		const state = sendState(chatOf(), pool(0.5));

		expect(state.blocker).toBeUndefined();
		expect(state.canSend).toBe(true);
	});

	test("a used-up pool blocks sending as the composer's exhausted notice", () => {
		const state = sendState(chatOf(), pool(1));

		expect(state.blocker?.reason).toBe("exhausted");
		expect(state.canSend).toBe(false);
	});

	test("no pool covering the model blocks sending", () => {
		const state = sendState(chatOf(), {
			available: false,
			pool: null,
		});

		expect(state.blocker?.reason).toBe("quota");
		expect(state.canSend).toBe(false);
	});

	test("a chat without a model cannot send", () => {
		const state = sendState(
			chatOf({
				model: {
					providerId: null,
					modelId: null,
				},
			}),
		);

		expect(state.canSend).toBe(false);
	});

	test("a bot's unusable required model blocks sending even with room in the pool", () => {
		const chat = {
			...chatOf({
				botId: crypto.randomUUID() as BotId,
			}),
			effectiveModel: {
				source: "bot-required" as const,
				providerId,
				modelId,
				botSetup: {
					model: {
						usable: false,
					},
				},
			},
		};
		const state = sendState(chat as never, pool(0.5));

		expect(state.blocker?.reason).toBe("bot-model");
		expect(state.canSend).toBe(false);
	});

	test("a read-only chat cannot send", () => {
		const state = sendState(
			chatOf({
				readOnly: {
					reason: "not-member",
				},
			}),
			pool(0.5),
		);

		expect(state.canSend).toBe(false);
	});

	test("an Assistant conversation sends with the organisation's model and follows its pool, not the chat's", () => {
		const state = sendState(chatOf(), pool(1), {
			kind: "assistant",
			quotaModel: assistantModel,
		});

		expect(state.selectedModel).toEqual(assistantModel);
		expect(state.blocker?.reason).toBe("exhausted");
		expect(state.canSend).toBe(false);
	});
});
