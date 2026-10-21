import { Chat } from "@ai-sdk/react";
import type { ChatId, ChatMessageId } from "@orcai/core";
import type { ContinueChatInput } from "@orcai/schema";
import type { ChatStatus, InferUITools, UIMessageChunk } from "ai";
import { pausedStep } from "@/lib/ai/turn-view/paused-step";
import type { ChatPhase, ClientToolName } from "@/lib/ai/turn-view/turn-view";
import type {
	ChatAgentTools,
	ChatAgentUIMessage,
} from "@/lib/ai/types/chat-agent-message";
import { errorReasonOf } from "@/lib/errors/describe-error";

/** Stored messages, oldest first, and the cursor to the page before them. */
export interface ChatPage {
	messages: ChatAgentUIMessage[];
	before: number | undefined;
	hasMore: boolean;
}

/** How a session reaches the server and the data a turn may change. */
export interface ChatPort {
	/** Opens a turn for a new user message. */
	chat: (
		input: {
			chatId: ChatId;
			message: ChatAgentUIMessage;
			zedToken: string | undefined;
		},
		signal: AbortSignal,
	) => Promise<ReadableStream<UIMessageChunk>>;
	/** Runs a paused step with its answers. */
	continue: (
		input: ContinueChatInput,
		signal: AbortSignal,
	) => Promise<ReadableStream<UIMessageChunk>>;
	/** A stored message, or undefined once it was dropped. */
	find: (input: {
		chatId: ChatId;
		id: ChatMessageId;
		zedToken: string | undefined;
	}) => Promise<ChatAgentUIMessage | undefined>;
	/** The newest page, or the page before `before`. */
	list: (input: {
		chatId: ChatId;
		before?: number;
		zedToken: string | undefined;
	}) => Promise<ChatPage>;
	/** Refreshes what a finished turn may have changed. */
	turnEnded: (message: ChatAgentUIMessage) => Promise<void>;
}

type ClientToolOutputOf<Name extends ClientToolName> =
	InferUITools<ChatAgentTools>[Name]["output"];

/** Answers the paused step of the latest reply; calls outside it are ignored. */
export interface StepAnswers {
	approve: (decision: {
		id: string;
		approved: boolean;
		reason?: string;
	}) => void;
	/** `zedToken` is what the widget's write returned, so the continuation reads it. */
	output: <Name extends ClientToolName>(answer: {
		tool: Name;
		toolCallId: string;
		output: ClientToolOutputOf<Name>;
		zedToken?: string;
	}) => void;
	/** Runs a step whose answers are all in but that has not run, as after a reload. */
	continue: () => Promise<void>;
}

export const phaseOf = (status: ChatStatus, storing: boolean): ChatPhase => {
	if (storing) return "storing";
	switch (status) {
		case "submitted":
			return "sending";
		case "streaming":
			return "streaming";
		case "error":
			return "error";
		case "ready":
			return "idle";
	}
};

const STORE_POLL_MS = 250;
const STORE_POLL_ATTEMPTS = 40;

/**
 * One chat's turns in the browser, built on the SDK's `Chat`: sending, stopping,
 * answering and continuing a paused step, the zedTokens each request reads at,
 * waiting for a cut-off reply to be stored, reloading after a conflict, older
 * pages, and refreshing what a turn changed. React renders `chat` through
 * `useChat({ chat })`.
 */
export class ChatSession {
	readonly chat: Chat<ChatAgentUIMessage>;
	readonly #chatId: ChatId;
	readonly #port: ChatPort;
	readonly #loaded: Set<string>;
	readonly #listeners = new Set<() => void>();
	/** The newest token seen: the page's, a turn's, then a widget's write. */
	#zedToken: string | undefined;
	/** A widget's write in the paused step; its token also covers the paused turn's writes. */
	#answerZedToken: string | undefined;
	#storing = false;
	#settled: Promise<void> = Promise.resolve();
	#before: number | undefined;
	#hasMore: boolean;
	#loadingEarlier: Promise<boolean> | undefined;
	#sentFirst = false;

	constructor({
		chatId,
		page,
		zedToken,
		port,
	}: {
		chatId: ChatId;
		page: ChatPage;
		zedToken: string | undefined;
		port: ChatPort;
	}) {
		this.#chatId = chatId;
		this.#port = port;
		this.#zedToken = zedToken;
		this.#loaded = new Set(page.messages.map((message) => message.id));
		this.#before = page.before;
		this.#hasMore = page.hasMore;
		this.chat = new Chat<ChatAgentUIMessage>({
			id: chatId,
			messages: page.messages,
			generateId: () => crypto.randomUUID(),
			sendAutomaticallyWhen: ({ messages }) => {
				const last = messages.at(-1);
				return last !== undefined && pausedStep(last)?.answered === true;
			},
			transport: {
				sendMessages: async ({ messages, abortSignal }) => {
					// Stop cuts the stream only once the server has answered, so the reply is already reserved.
					const request = new AbortController();
					const stream = await this.#open(messages.at(-1), request.signal);
					if (abortSignal?.aborted) request.abort();
					abortSignal?.addEventListener("abort", () => request.abort());
					return stream;
				},
				reconnectToStream: async () => null,
			},
			onFinish: (finish) => {
				this.#settled = this.#settle(finish);
			},
			onError: (error) => {
				if (errorReasonOf(error)?.reason === "CHAT_TURN_NOT_AWAITING") {
					// On failure the shown page stays and the error banner reports the turn.
					this.#reloadLatest().catch(() => undefined);
				}
			},
		});
	}

	get phase(): ChatPhase {
		return phaseOf(this.chat.status, this.#storing);
	}

	/** A cut-off reply is still being saved, so the next turn waits. */
	get storing() {
		return this.#storing;
	}

	get hasEarlier() {
		return this.#hasMore && this.#before !== undefined;
	}

	/** Notified when `storing` changes; the SDK's `Chat` notifies the rest. */
	subscribe = (listener: () => void) => {
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	};

	/** The message came from the server rather than arriving during this visit. */
	wasLoaded(messageId: string) {
		return this.#loaded.has(messageId);
	}

	/** A newer page token, as when the route's search changes. */
	sawZedToken(zedToken: string | undefined) {
		this.#zedToken = zedToken ?? this.#zedToken;
	}

	/** Resolves once the turn and anything it continued into are stored and refreshed. */
	send = async (message: {
		text: string;
		metadata?: ChatAgentUIMessage["metadata"];
	}) => {
		await this.#settled;
		await this.chat.sendMessage(message);
		await this.#settled;
	};

	/** Sends a chat's opening message once, while it has none. */
	sendFirst(text: string) {
		if (this.#sentFirst || this.chat.messages.length > 0) return undefined;
		this.#sentFirst = true;
		return this.send({
			text,
		}).catch((error: unknown) => {
			this.#sentFirst = false;
			throw error;
		});
	}

	/** Resolves once the cut-off reply is stored. */
	stop = async () => {
		await this.chat.stop();
		await this.#settled;
	};

	readonly answers: StepAnswers = {
		approve: (decision) => {
			const step = this.#answerableStep();
			if (!step?.approvals.some((call) => call.approval.id === decision.id)) {
				return;
			}
			void this.chat.addToolApprovalResponse(decision);
		},
		output: ({ tool, toolCallId, output, zedToken }) => {
			const step = this.#answerableStep();
			if (!step?.awaiting.some((call) => call.toolCallId === toolCallId)) {
				return;
			}
			if (zedToken) {
				this.#zedToken = zedToken;
				this.#answerZedToken = zedToken;
			}
			void this.chat.addToolOutput({
				tool,
				toolCallId,
				output,
			});
		},
		continue: async () => {
			if (!this.#answerableStep()?.answered) return;
			await this.chat.sendMessage();
			await this.#settled;
		},
	};

	/**
	 * Prepends the page before the oldest loaded message and resolves whether
	 * more remain.
	 */
	loadEarlier = (): Promise<boolean> => {
		this.#loadingEarlier ??= this.#loadEarlier().finally(() => {
			this.#loadingEarlier = undefined;
		});
		return this.#loadingEarlier;
	};

	async #loadEarlier() {
		if (!this.hasEarlier) return false;
		const page = await this.#port.list({
			chatId: this.#chatId,
			before: this.#before,
			zedToken: this.#zedToken,
		});
		this.#before = page.before;
		this.#hasMore = page.hasMore;
		this.#markLoaded(page.messages);
		const current = this.chat.messages;
		const currentIds = new Set(current.map((message) => message.id));
		this.chat.messages = [
			...page.messages.filter((message) => !currentIds.has(message.id)),
			...current,
		];
		return this.hasEarlier;
	}

	#answerableStep() {
		const phase = this.phase;
		if (phase !== "idle" && phase !== "error") return undefined;
		const last = this.chat.lastMessage;
		return last && pausedStep(last);
	}

	/**
	 * The server holds the history, so only the new user message travels, or
	 * for an assistant reply the answers its paused step holds.
	 */
	#open(message: ChatAgentUIMessage | undefined, signal: AbortSignal) {
		switch (message?.role) {
			case "user":
				return this.#port.chat(
					{
						chatId: this.#chatId,
						message,
						zedToken: this.#zedToken,
					},
					signal,
				);
			case "assistant": {
				const answers = pausedStep(message)?.answers;
				return this.#port.continue(
					{
						chatId: this.#chatId,
						messageId: message.id,
						approvals: answers?.approvals ?? [],
						toolOutputs: answers?.toolOutputs ?? [],
						zedToken: this.#answerZedToken,
					},
					signal,
				);
			}
			default:
				throw new Error("Only a user message or answers can be sent");
		}
	}

	async #settle({
		message,
		isAbort,
		isDisconnect,
		isError,
	}: {
		message: ChatAgentUIMessage;
		isAbort: boolean;
		isDisconnect: boolean;
		isError: boolean;
	}) {
		this.#zedToken = message.metadata?.zedToken ?? this.#zedToken;
		// A finished stream closes after the reply is stored; any other ending may still be saving.
		if (isAbort || isDisconnect || isError) {
			this.#setStoring(true);
			await this.#waitForStored(message.id).finally(() =>
				this.#setStoring(false),
			);
		} else {
			this.#answerZedToken = undefined;
		}
		await this.#port.turnEnded(message);
	}

	/** Resolves once the reply is filled in or dropped, so the next turn's context includes it. */
	async #waitForStored(id: ChatMessageId) {
		for (let attempt = 0; attempt < STORE_POLL_ATTEMPTS; attempt++) {
			try {
				const reply = await this.#port.find({
					chatId: this.#chatId,
					id,
					zedToken: this.#zedToken,
				});
				if (!reply || reply.parts.length > 0) return;
			} catch {
				// Retried until the attempts run out.
			}
			await new Promise((resolve) => setTimeout(resolve, STORE_POLL_MS));
		}
	}

	/** Replaces the newest page with the stored rows, as another tab left them. */
	async #reloadLatest() {
		const page = await this.#port.list({
			chatId: this.#chatId,
			zedToken: this.#zedToken,
		});
		const storedIds = new Set(page.messages.map((message) => message.id));
		this.#markLoaded(page.messages);
		this.chat.messages = [
			...this.chat.messages.filter((message) => !storedIds.has(message.id)),
			...page.messages,
		];
	}

	#markLoaded(messages: readonly ChatAgentUIMessage[]) {
		for (const message of messages) {
			this.#loaded.add(message.id);
		}
	}

	#setStoring(storing: boolean) {
		this.#storing = storing;
		for (const listener of this.#listeners) listener();
	}
}
