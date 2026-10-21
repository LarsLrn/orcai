import { mock } from "bun:test";
import {
	ReadableStream,
	TextDecoderStream,
	TextEncoderStream,
	TransformStream,
	WritableStream,
} from "node:stream/web";
import type {
	ChatId,
	ChatMessageId,
	ModelId,
	OrganizationId,
	ProviderId,
	ProviderKind,
	UserId,
} from "@orcai/core";
import type { ChatConfig } from "@orcai/schema";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { AppConfigService } from "@/lib/effect/services/config";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { memberCapabilities, scriptedFetch } from "../agents/test-provider";
import { withQuotaServices } from "../metered-call/test-quota";
import { answers, FakeServices } from "../tools/assistant/test-procedures";
import type { ReplyStore, StoredChat } from "./reply-store";

/**
 * Runs turns as the chat procedures do, on an in-memory store, against the
 * kind's real provider behind a scripted fetch. Import it before the turn
 * module, which loads the AI SDK.
 */

// The SDK subclasses TransformStream when it loads, so the native stream globals go in first.
Object.assign(globalThis, {
	ReadableStream,
	WritableStream,
	TransformStream,
	TextDecoderStream,
	TextEncoderStream,
});

mock.module("@/lib/encryption", () => ({
	providerApiKey: () => Effect.succeed("key"),
}));

export const ORGANIZATION_ID =
	"00000000-0000-4000-8000-00000000000a" as OrganizationId;
const PROVIDER_ID = "00000000-0000-4000-8000-00000000000b" as ProviderId;
const MODEL_ID = "00000000-0000-4000-8000-00000000000c" as ModelId;

const requester = {
	organizationId: ORGANIZATION_ID,
	user: {
		id: "00000000-0000-4000-8000-00000000000d" as UserId,
		name: "Ada",
		email: "ada@example.org",
	},
	context: {
		secureCookies: false,
	} as ORPCContext,
};

export const chatRow = (chat: Partial<StoredChat> = {}): StoredChat => ({
	id: crypto.randomUUID() as ChatId,
	title: "A chat",
	userId: requester.user.id,
	botId: null,
	parentChatId: null,
	branchedFromMessageId: null,
	config: {
		providerId: PROVIDER_ID,
		modelId: MODEL_ID,
	} as ChatConfig,
	kind: "chat",
	organizationId: null,
	createdAt: new Date(0),
	updatedAt: new Date(0),
	...chat,
});

export const assistantRow = () =>
	chatRow({
		kind: "assistant",
		config: null,
		organizationId: ORGANIZATION_ID,
	});

/** Answers the reads of a turn's setup: the organisation, its model and provider, the caller. */
export const answerSetup = ({
	providerKind,
	providerModelId,
	model = {},
	chatBlocks = [],
}: {
	providerKind: ProviderKind;
	providerModelId: string;
	model?: Partial<{
		isDeprecated: boolean;
		capabilities: string[];
		contextWindow: number;
		maxOutputTokens: number;
	}>;
	chatBlocks?: unknown[];
}) => {
	answers["organization.find"] = () =>
		Effect.succeed({
			data: {
				id: ORGANIZATION_ID,
				name: "Org",
				assistantModelId: MODEL_ID,
			},
		});
	answers["model.find"] = () =>
		Effect.succeed({
			data: {
				id: MODEL_ID,
				providerId: PROVIDER_ID,
				providerModelId,
				isDeprecated: false,
				capabilities: [
					"tool-calling",
				],
				...model,
			},
		});
	answers["provider.find"] = () =>
		Effect.succeed({
			data: {
				id: PROVIDER_ID,
				kind: providerKind,
				enabled: true,
				endpoint:
					providerKind === "openai-compatible" ? "https://llm.test/v1" : null,
			},
		});
	answers["chatBlock.list"] = () =>
		Effect.succeed({
			data: chatBlocks,
		});
	answers["organizationMember.find"] = () =>
		Effect.succeed({
			data: {
				role: "member",
			},
		});
	answers["authorization.organizationCapabilities"] = () =>
		Effect.succeed({
			data: {
				capabilities: memberCapabilities,
			},
		});
};

const AppConfigTest = Layer.succeed(AppConfigService, {
	config: {} as never,
	docs: undefined,
});

/** Runs a turn effect with the store and the services the fakes stand in for. */
export const runTurn = <A, E>(
	effect: Effect.Effect<A, E, unknown>,
	store: Layer.Layer<ReplyStore>,
) =>
	Effect.runPromise(
		withQuotaServices(
			effect.pipe(
				Effect.provide(Layer.mergeAll(store, AppConfigTest, FakeServices)),
			) as Effect.Effect<A, E, never>,
		),
	);

/** Reads a turn's stream to its end, which runs the agent and settles the reply. */
export const drain = async (stream: AsyncIterable<unknown>) => {
	for await (const _ of stream) {
		// The turn runs as the stream is read.
	}
};

/**
 * A conversation on one chat: each message starts a turn, each decision
 * continues the paused reply, and the store holds the rows in between.
 */
export const conversation = async (
	chat: StoredChat,
	providerKind: ProviderKind,
) => {
	const { startTurn, continueTurn } = await import("./turn");
	const { memoryReplyStore } = await import("./memory-reply-store");
	const store = memoryReplyStore([
		chat,
	]);
	const provider = scriptedFetch(providerKind);
	let beforeRequest: ((count: number) => void) | undefined;
	const fetch = ((input, init) => {
		beforeRequest?.(provider.bodies.length + 1);
		return provider.fetch(input, init);
	}) as typeof globalThis.fetch;
	const run = <A, E>(
		effect: Effect.Effect<A, E, unknown>,
		storeLayer: Layer.Layer<ReplyStore> = store.layer,
	) => {
		globalThis.fetch = fetch;
		return runTurn(effect, storeLayer);
	};

	return {
		chatId: chat.id,
		store,
		messages: () => store.messages(chat.id),
		bodies: provider.bodies,
		script: provider.script,
		/** Runs before each model request with its number. */
		beforeRequest: (callback: (count: number) => void) => {
			beforeRequest = callback;
		},
		send: async (text: string, stop?: AbortSignal) =>
			drain(
				await run(
					startTurn({
						...requester,
						chatId: chat.id,
						message: {
							id: crypto.randomUUID() as ChatMessageId,
							role: "user",
							parts: [
								{
									type: "text",
									text,
								},
							],
						},
						stop,
					}),
				),
			),
		/** Answers every approval the paused reply waits for. */
		decide: async (approved: boolean) => {
			const reply = store.messages(chat.id).at(-1);
			if (!reply) {
				throw new Error("nothing to continue");
			}
			return drain(
				await run(
					continueTurn({
						...requester,
						chatId: chat.id,
						replyId: reply.id,
						decisions: reply.parts.flatMap((part) =>
							typeof part === "object" &&
							part !== null &&
							"state" in part &&
							part.state === "approval-requested" &&
							"approval" in part
								? [
										{
											approvalId: (
												part.approval as {
													id: string;
												}
											).id,
											approved,
										},
									]
								: [],
						),
						toolOutputs: [],
						clientZedToken: undefined,
						stop: undefined,
					}),
				),
			);
		},
		start: startTurn,
		continue: continueTurn,
		requester,
		run,
	};
};
