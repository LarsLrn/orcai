import { type ProviderCompaction, providerCompaction } from "@orcai/ai";
import {
	type CompactionSource,
	compactionPoint,
	compactionSource,
	type ModelProviderKind,
} from "@orcai/core";
import { charTokens, partTokens, promptTokens } from "@orcai/quota";
import type { ChatMessageMetadata, ModelTokenLimits } from "@orcai/schema";
import {
	asSchema,
	type ModelMessage,
	pruneMessages,
	type SystemModelMessage,
	type ToolSet,
	type UIMessage,
} from "ai";
import * as Effect from "effect/Effect";

/** What a model without a recorded context window is assumed to hold. */
const DEFAULT_CONTEXT_WINDOW = 128_000;

/** A prompt this share of the budget is compacted, natively or by our own summary. */
const COMPACTION_TRIGGER = 0.8;

/** Trimming cuts below the budget, so the next turns keep the cached prefix instead of trimming again. */
const TRIM_TARGET = 0.75;

/** How the summary of the earlier conversation reaches the model, ahead of the latest turn. */
export const SUMMARY_PREFIX = "Summary of the earlier conversation:\n\n";

type MessageTokens = (message: UIMessage) => number;

/** Message estimates that count each part once, however often a fit asks. */
const messageTokens = (): MessageTokens => {
	const sizes = new WeakMap<object, number>();
	return (message) =>
		message.parts.reduce((sum, part) => {
			const size = sizes.get(part) ?? partTokens(part);
			sizes.set(part, size);
			return sum + size;
		}, 0);
};

/** How the provider's count of a reply's context compares to the estimate it was sent with. */
const scaleOf = (
	message: UIMessage<ChatMessageMetadata> | undefined,
	tokens: MessageTokens,
) => {
	const recorded = message?.role === "assistant" ? message.metadata : undefined;
	return recorded?.contextTokens && recorded.contextEstimate
		? recorded.contextTokens /
				(recorded.contextEstimate + tokens(message as UIMessage))
		: undefined;
};

/** The estimate of what every request sends besides the messages. */
export const requestTokens = async ({
	instructions,
	tools,
}: {
	instructions: SystemModelMessage[];
	tools: ToolSet;
}) =>
	charTokens(instructions) +
	charTokens(
		await Promise.all(
			Object.entries(tools).map(async ([name, tool]) => ({
				name,
				description: tool.description,
				inputSchema: await asSchema(tool.inputSchema).jsonSchema,
			})),
		),
	);

/** The tokens a prompt may take: the context window minus the reserved output. */
export const promptBudget = ({
	contextWindow,
	reservedOutputTokens,
}: {
	contextWindow: number | null;
	reservedOutputTokens: number;
}) => (contextWindow ?? DEFAULT_CONTEXT_WINDOW) - reservedOutputTokens;

/** The prompt size at which a conversation is compacted. */
export const compactionTrigger = (budget: number) =>
	Math.floor(budget * COMPACTION_TRIGGER);

/** The output a turn without its own cap gets, within the model's maximum. */
const DEFAULT_MAX_OUTPUT_TOKENS = 16_384;

/**
 * Without its own cap a turn reserves a guess at its output, which leaves at
 * least half the context window to the prompt. The rest is the budget, which
 * sets where the conversation compacts.
 */
export const turnLimits = ({
	kind,
	tokenLimits,
	maxOutputTokens: ownCap,
}: {
	kind: ModelProviderKind;
	tokenLimits: ModelTokenLimits;
	maxOutputTokens: number | undefined;
}): {
	maxOutputTokens: number;
	budget: number;
	compaction: ProviderCompaction;
} => {
	const { contextWindow } = tokenLimits;
	const half = Math.floor((contextWindow ?? DEFAULT_CONTEXT_WINDOW) / 2);
	const maxOutputTokens =
		ownCap ??
		Math.min(
			half,
			tokenLimits.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
			DEFAULT_MAX_OUTPUT_TOKENS,
		);
	const budget = promptBudget({
		contextWindow,
		reservedOutputTokens: maxOutputTokens,
	});
	return {
		maxOutputTokens,
		budget,
		compaction: providerCompaction(kind, compactionTrigger(budget)),
	};
};

export type ContextFit<M> =
	| {
			fits: true;
			/** The prompt to send without a new summary. */
			messages: M[];
			/** Whether older turns were left out. */
			trimmed: boolean;
			/** The estimate of the prompt without the reply, for the reply's metadata. */
			estimate: number;
			/** What a step's messages may take by the uncalibrated estimate, as the prompt's calibration sees it. */
			stepTokens: number;
			/** Set when the prompt reached the trigger: the history our own summary replaces, all but the latest turn. */
			summarize: M[] | undefined;
	  }
	| {
			fits: false;
	  };

/**
 * The prompt from the latest compaction the turn reads. A compaction block or
 * item stays in its reply, which the prompt then starts with; our own summary
 * goes to the model as a user message before the turn it was written in. A
 * compaction the turn does not read is left out.
 */
const fromCompaction = <M extends UIMessage<ChatMessageMetadata>>(
	messages: M[],
	reads: (source: CompactionSource) => boolean,
) => {
	const point = compactionPoint(messages, reads);
	const unread = (part: M["parts"][number]) => {
		const source = compactionSource(part);
		return source !== undefined && !reads(source);
	};
	const withParts = (message: M, parts: M["parts"]) =>
		parts.length === 0
			? []
			: [
					{
						...message,
						parts,
					},
				];
	const tidy = (kept: M[]) =>
		kept.flatMap((message) =>
			withParts(
				message,
				message.parts.filter((part) => !unread(part)),
			),
		);

	if (!point) {
		return {
			prompt: tidy(messages),
			anchorsFrom: 0,
			summarized: false,
			before: [],
		};
	}
	// Replies up to the compaction recorded what the provider counted before it.
	const before = messages.slice(0, point.message);
	const compacting = messages[point.message];
	const rest = tidy(messages.slice(point.message + 1));
	if (point.source !== "summary") {
		const head = withParts(compacting, compacting.parts.slice(point.part));
		return {
			prompt: [
				...head,
				...rest,
			],
			anchorsFrom: head.length,
			summarized: false,
			before,
		};
	}

	const turnStart = messages
		.slice(0, point.message)
		.map(({ role }) => role)
		.lastIndexOf("user");
	const summary = compacting.parts[point.part] as {
		text: string;
	};
	const turn = tidy(messages.slice(Math.max(turnStart, 0), point.message));
	const head = withParts(
		compacting,
		compacting.parts.filter((_, index) => index !== point.part),
	);
	return {
		prompt: [
			{
				id: `${compacting.id}-summary`,
				role: "user",
				parts: [
					{
						type: "text",
						text: `${SUMMARY_PREFIX}${summary.text}`,
					},
				],
			} as M,
			...turn,
			...tidy(head),
			...rest,
		],
		// The summary's reply recorded what the provider counted of the prompt that starts at it.
		anchorsFrom: 1 + turn.length,
		summarized: true,
		before,
	};
};

/**
 * The prompt from the latest compaction the turn reads, cut into turns. Sizes
 * are char estimates, calibrated by the context tokens the latest reply after
 * the compaction recorded, so the history it covers counts what the provider
 * counted.
 */
const promptTurns = <M extends UIMessage<ChatMessageMetadata>>(
	messages: M[],
	compaction: {
		reads: (source: CompactionSource) => boolean;
	},
	tokens: MessageTokens,
) => {
	const { prompt, anchorsFrom, summarized, before } = fromCompaction(
		messages,
		compaction.reads,
	);
	const sizes = prompt.map((message) => tokens(message));
	const anchor = prompt
		.map(
			(message, index) =>
				index >= anchorsFrom && scaleOf(message, tokens) !== undefined,
		)
		.lastIndexOf(true);
	const scale = scaleOf(prompt[anchor], tokens) ?? 1;
	// The request is the same as before the compaction, so a reply from then still calibrates it.
	const requestScale =
		anchor >= 0
			? scale
			: (before
					.map((message) => scaleOf(message, tokens))
					.filter((found) => found !== undefined)
					.at(-1) ?? 1);
	const cost = (index: number) =>
		index <= anchor ? sizes[index] * scale : sizes[index];

	const turnStarts = prompt.flatMap((message, index) =>
		message.role === "user" && index > 0
			? [
					index,
				]
			: [],
	);
	const turns = [
		0,
		...turnStarts,
	].map((start, index) => {
		const end = turnStarts[index] ?? prompt.length;
		const indices = Array.from(
			{
				length: end - start,
			},
			(_, offset) => start + offset,
		);
		return {
			indices,
			cost: indices.reduce((sum, index) => sum + cost(index), 0),
		};
	});
	return {
		prompt,
		summarized,
		sizes,
		cost,
		requestScale,
		turns,
	};
};

/**
 * Where the messages `fitContextWindow` depends on start. Once the newest
 * turns besides the latest take more than the budget, the older ones are left
 * out and summarized by no one, whatever they hold. Reading a file only adds
 * parts, so the messages before this index may go to the fit with their
 * files unread.
 */
const fitReadsFrom = <
	M extends UIMessage<ChatMessageMetadata> & {
		attachments?: readonly unknown[];
	},
>({
	messages,
	readFrom,
	budget,
	compaction,
	tokens,
}: {
	messages: M[];
	/** Where the messages whose files were read start. */
	readFrom: number;
	/** See `promptBudget`. */
	budget: number;
	compaction: {
		reads: (source: CompactionSource) => boolean;
	};
	tokens: MessageTokens;
}) => {
	// A read file adds at least one part, so an unread one counts as an empty part.
	const sized = messages.map((message, index) =>
		index >= readFrom ||
		message.role !== "user" ||
		(message.attachments?.length ?? 0) === 0
			? message
			: {
					...message,
					parts: [
						...message.parts,
						...(message.attachments ?? []).map(() => ({
							type: "text" as const,
							text: "",
						})),
					],
				},
	);
	const { prompt, turns } = promptTurns(sized, compaction, tokens);
	const positions = new Map(
		messages.map(({ id }, position) => [
			id,
			position,
		]),
	);
	// Our own summary's message is new; the reply it comes from holds no attachments.
	const firstOf = (indices: number[]) =>
		Math.min(
			...indices.flatMap((index) => positions.get(prompt[index].id) ?? []),
		);
	let taken = 0;
	for (const turn of turns.slice(0, -1).reverse()) {
		taken += turn.cost;
		const first = firstOf(turn.indices);
		if (taken > budget && Number.isFinite(first)) {
			return first;
		}
	}
	return Math.min(firstOf(prompt.map((_, index) => index)), messages.length);
};

/** How many files a turn reads first; each batch after reads twice as many. */
const FIRST_READ_BATCH = 6;

/**
 * The messages with the files of every turn the fit may send or summarize
 * read by `read`, newest first in growing batches, until the turns read take
 * more than the fit can keep. `read` gets each batch before the older ones,
 * and a chat that fits whole takes few rounds.
 */
export const readForFit = <
	M extends UIMessage<ChatMessageMetadata> & {
		attachments?: readonly unknown[];
	},
	E,
	R,
>({
	messages,
	budget,
	compaction,
	read,
}: {
	messages: M[];
	/** See `promptBudget`. */
	budget: number;
	compaction: {
		reads: (source: CompactionSource) => boolean;
	};
	read: (messages: M[]) => Effect.Effect<M[], E, R>;
}) =>
	Effect.gen(function* () {
		// Reading keeps the parts it had, so each round sizes only the new ones.
		const tokens = messageTokens();
		let prompt = messages;
		let from = messages.length;
		let batch = FIRST_READ_BATCH;
		while (true) {
			const needed = fitReadsFrom({
				messages: prompt,
				readFrom: from,
				budget,
				compaction,
				tokens,
			});
			if (needed >= from) {
				return prompt;
			}
			let start = from;
			let files = 0;
			while (start > needed && files < batch) {
				start -= 1;
				files += prompt[start].attachments?.length ?? 0;
			}
			prompt = [
				...prompt.slice(0, start),
				...(yield* read(prompt.slice(start, from))),
				...prompt.slice(from),
			];
			from = start;
			batch *= 2;
		}
	});

/**
 * Decides a turn's prompt. It starts at the latest compaction the turn reads.
 * Once it reaches the compaction trigger without native compaction, all but
 * its latest turn are handed to our own summary. Beyond the budget it leaves
 * out the oldest whole turns, down to three quarters of it; the latest turn
 * stays. Sizes are those of `promptTurns`.
 */
export const fitContextWindow = <M extends UIMessage<ChatMessageMetadata>>({
	messages,
	replyId,
	requestTokens,
	budget,
	compaction,
}: {
	messages: M[];
	/** The reply the prompt is for, left out of the estimate when it continues. */
	replyId: string;
	requestTokens: number;
	/** See `promptBudget`. */
	budget: number;
	compaction: {
		native: boolean;
		reads: (source: CompactionSource) => boolean;
	};
}): ContextFit<M> => {
	const { prompt, summarized, sizes, cost, requestScale, turns } = promptTurns(
		messages,
		compaction,
		messageTokens(),
	);

	const full =
		requestTokens * requestScale +
		turns.reduce((sum, turn) => sum + turn.cost, 0);
	// One request carries the history to summarize, so its newest turns that fit the budget.
	let room = budget;
	const history: number[] = [];
	for (const turn of turns.slice(0, -1).reverse()) {
		if (turn.cost > room) {
			break;
		}
		room -= turn.cost;
		history.unshift(...turn.indices);
	}
	// A summary alone before the latest turn has nothing left to summarize.
	const summarizes =
		!compaction.native &&
		full > compactionTrigger(budget) &&
		history.some((index) => !(summarized && index === 0));

	let total = full;
	const dropped = new Set<number>();
	if (total > budget) {
		for (const turn of turns.slice(0, -1)) {
			if (total <= budget * TRIM_TARGET) {
				break;
			}
			total -= turn.cost;
			for (const index of turn.indices) {
				dropped.add(index);
			}
		}
	}
	if (total > budget) {
		return {
			fits: false,
		};
	}

	const kept = prompt.flatMap((_, index) => (dropped.has(index) ? [] : index));
	const keptSize = kept.reduce((sum, index) => sum + sizes[index], 0);
	return {
		fits: true,
		messages: kept.map((index) => prompt[index]),
		stepTokens: Math.floor(
			(budget - requestTokens * requestScale) /
				(keptSize === 0
					? 1
					: kept.reduce((sum, index) => sum + cost(index), 0) / keptSize),
		),
		trimmed: dropped.size > 0,
		estimate:
			requestTokens +
			prompt.reduce(
				(sum, message, index) =>
					dropped.has(index) || message.id === replyId
						? sum
						: sum + sizes[index],
				0,
			),
		summarize: summarizes ? history.map((index) => prompt[index]) : undefined,
	};
};

/**
 * A step's messages within what the prompt may take besides the request, if
 * need be without the tool calls of steps before the latest; undefined when
 * they still do not fit.
 */
export const fitStep = (messages: ModelMessage[], tokens: number) => {
	if (promptTokens(messages) <= tokens) {
		return messages;
	}
	const pruned = pruneMessages({
		messages,
		toolCalls: "before-last-2-messages",
	});
	return promptTokens(pruned) <= tokens ? pruned : undefined;
};
