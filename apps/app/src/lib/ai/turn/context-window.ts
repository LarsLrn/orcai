import type { ChatMessageMetadata } from "@orcai/schema";
import {
	asSchema,
	type SystemModelMessage,
	type ToolSet,
	type UIMessage,
} from "ai";

/** What a model without a recorded context window is assumed to hold. */
export const DEFAULT_CONTEXT_WINDOW = 128_000;

/** Providers bill an image by its size; this covers a large one. */
const IMAGE_TOKENS = 1_600;

const charTokens = (value: unknown) =>
	Math.ceil(JSON.stringify(value).length / 4);

const messageTokens = (message: UIMessage) =>
	message.parts.reduce(
		(sum, part) =>
			sum + (part.type === "file" ? IMAGE_TOKENS : charTokens(part)),
		0,
	);

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

export type ContextFit<M> =
	| {
			fits: true;
			messages: M[];
			/** Whether older turns were left out. */
			trimmed: boolean;
			/** The estimate of the prompt without the reply, for the reply's metadata. */
			estimate: number;
	  }
	| {
			fits: false;
	  };

/**
 * Leaves out the oldest whole turns until the prompt fits the context window
 * minus the reserved output. The latest turn and the pinned message's turn
 * stay. Sizes are char estimates, calibrated by the context tokens the latest
 * reply recorded, so the history it covers counts what the provider counted.
 */
export const fitContextWindow = <M extends UIMessage<ChatMessageMetadata>>({
	messages,
	replyId,
	pinnedId,
	requestTokens,
	contextWindow,
	reservedOutputTokens,
}: {
	messages: M[];
	/** The reply the prompt is for, left out of the estimate when it continues. */
	replyId: string;
	pinnedId: string | undefined;
	requestTokens: number;
	contextWindow: number | null;
	reservedOutputTokens: number;
}): ContextFit<M> => {
	const sizes = messages.map(messageTokens);
	const anchor = messages
		.map(
			({ role, metadata }) =>
				role === "assistant" &&
				metadata?.contextTokens !== undefined &&
				metadata.contextEstimate !== undefined,
		)
		.lastIndexOf(true);
	const recorded = messages[anchor]?.metadata;
	const scale =
		recorded?.contextTokens && recorded.contextEstimate
			? recorded.contextTokens / (recorded.contextEstimate + sizes[anchor])
			: 1;
	const cost = (index: number) =>
		index <= anchor ? sizes[index] * scale : sizes[index];

	const turnStarts = messages.flatMap((message, index) =>
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
		const end = turnStarts[index] ?? messages.length;
		const indices = Array.from(
			{
				length: end - start,
			},
			(_, offset) => start + offset,
		);
		return {
			indices,
			cost: indices.reduce((sum, index) => sum + cost(index), 0),
			pinned: indices.some((index) => messages[index].id === pinnedId),
		};
	});

	const budget =
		(contextWindow ?? DEFAULT_CONTEXT_WINDOW) - reservedOutputTokens;
	let total =
		requestTokens * scale + turns.reduce((sum, turn) => sum + turn.cost, 0);
	const dropped = new Set<number>();
	for (const turn of turns.slice(0, -1)) {
		if (total <= budget) {
			break;
		}
		if (!turn.pinned) {
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

	const kept = messages.filter((_, index) => !dropped.has(index));
	return {
		fits: true,
		messages: kept,
		trimmed: dropped.size > 0,
		estimate:
			requestTokens +
			messages.reduce(
				(sum, message, index) =>
					dropped.has(index) || message.id === replyId
						? sum
						: sum + sizes[index],
				0,
			),
	};
};
