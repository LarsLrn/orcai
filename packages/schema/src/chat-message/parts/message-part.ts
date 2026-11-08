import { z } from "zod/v4";

const providerMetadataSchema = z.record(
	z.string(),
	z.record(z.string(), z.unknown()),
);

const streamStateSchema = z.enum([
	"streaming",
	"done",
]);

const textPartSchema = z.looseObject({
	type: z.literal("text"),
	text: z.string(),
	state: streamStateSchema.optional(),
	providerMetadata: providerMetadataSchema.optional(),
});

const reasoningPartSchema = z.looseObject({
	type: z.literal("reasoning"),
	id: z.string().optional(),
	text: z.string(),
	state: streamStateSchema.optional(),
	providerMetadata: providerMetadataSchema.optional(),
});

/** Provider content without its own part, e.g. an OpenAI compaction item. */
const customPartSchema = z.looseObject({
	type: z.literal("custom"),
	kind: z.templateLiteral([
		z.string(),
		".",
		z.string(),
	]),
	providerMetadata: providerMetadataSchema.optional(),
});

const sourceUrlPartSchema = z.looseObject({
	type: z.literal("source-url"),
	sourceId: z.string(),
	url: z.string(),
	title: z.string().optional(),
	providerMetadata: providerMetadataSchema.optional(),
});

const sourceDocumentPartSchema = z.looseObject({
	type: z.literal("source-document"),
	sourceId: z.string(),
	mediaType: z.string(),
	title: z.string(),
	filename: z.string().optional(),
	providerMetadata: providerMetadataSchema.optional(),
});

const filePartSchema = z.looseObject({
	type: z.literal("file"),
	mediaType: z.string(),
	filename: z.string().optional(),
	url: z.string(),
	providerMetadata: providerMetadataSchema.optional(),
});

const reasoningFilePartSchema = z.looseObject({
	type: z.literal("reasoning-file"),
	mediaType: z.string(),
	url: z.string(),
	providerMetadata: providerMetadataSchema.optional(),
});

const stepStartPartSchema = z.looseObject({
	type: z.literal("step-start"),
});

const dataPartSchema = z.looseObject({
	type: z.templateLiteral([
		"data-",
		z.string(),
	]),
	id: z.string().optional(),
	data: z.unknown(),
});

const approvalSchema = z.looseObject({
	id: z.string(),
	reason: z.string().optional(),
});

const answeredApprovalSchema = approvalSchema.extend({
	approved: z.boolean(),
});

const toolCallFields = {
	toolCallId: z.string(),
	title: z.string().optional(),
	providerExecuted: z.boolean().optional(),
	callProviderMetadata: providerMetadataSchema.optional(),
};

/** A tool call by its state; each state requires what it carries. */
const toolCallStatesSchema = z.discriminatedUnion("state", [
	z.looseObject({
		state: z.literal("input-streaming"),
		input: z.unknown().optional(),
	}),
	z.looseObject({
		state: z.literal("input-available"),
		input: z.unknown(),
	}),
	z.looseObject({
		state: z.literal("approval-requested"),
		input: z.unknown(),
		approval: approvalSchema,
	}),
	z.looseObject({
		state: z.literal("approval-responded"),
		input: z.unknown(),
		approval: answeredApprovalSchema,
	}),
	z.looseObject({
		state: z.literal("output-available"),
		input: z.unknown(),
		output: z.unknown(),
		preliminary: z.boolean().optional(),
		approval: answeredApprovalSchema.optional(),
	}),
	z.looseObject({
		state: z.literal("output-error"),
		input: z.unknown().optional(),
		errorText: z.string(),
		approval: answeredApprovalSchema.optional(),
	}),
	z.looseObject({
		state: z.literal("output-denied"),
		input: z.unknown(),
		approval: answeredApprovalSchema,
	}),
]);

/** A call of a tool the chat declares, typed `tool-<name>`. */
const toolPartSchema = z
	.looseObject({
		type: z.templateLiteral([
			"tool-",
			z.string(),
		]),
		...toolCallFields,
	})
	.and(toolCallStatesSchema);

/** A call of a tool the chat does not declare (any longer). */
const dynamicToolPartSchema = z
	.looseObject({
		type: z.literal("dynamic-tool"),
		toolName: z.string(),
		...toolCallFields,
	})
	.and(toolCallStatesSchema);

const namedPartSchemas = [
	textPartSchema,
	reasoningPartSchema,
	customPartSchema,
	sourceUrlPartSchema,
	sourceDocumentPartSchema,
	filePartSchema,
	reasoningFilePartSchema,
	stepStartPartSchema,
] as const;

/**
 * A part of a chat message as the AI SDK writes it; every write validates.
 * Extra fields are kept, so a part survives a roundtrip unchanged.
 */
export const chatMessagePartSchema = z.union([
	z.discriminatedUnion("type", namedPartSchemas),
	dynamicToolPartSchema,
	toolPartSchema,
	dataPartSchema,
]);

export type ChatMessagePart = z.infer<typeof chatMessagePartSchema>;

/**
 * What a row's parts hold: whatever any version wrote. Read them with
 * `readableChatMessageParts`, write over them with `mergeReadableParts`.
 */
export type StoredChatMessageParts = unknown[];

const isReadable = (part: unknown) =>
	chatMessagePartSchema.safeParse(part).success;

/** The stored parts this version can render and send to a model; the rest are left out. */
export const readableChatMessageParts = (
	parts: readonly unknown[],
): ChatMessagePart[] =>
	parts.flatMap((part) => {
		const parsed = chatMessagePartSchema.safeParse(part);
		return parsed.success
			? [
					parsed.data,
				]
			: [];
	});

/**
 * Writes `readable` over the stored parts this version reads, in order, and
 * keeps every other part where it is. Extra readable parts go to the end;
 * readable slots left over are removed.
 */
export const mergeReadableParts = (
	stored: readonly unknown[],
	readable: readonly ChatMessagePart[],
): StoredChatMessageParts => {
	let next = 0;
	const merged = stored.flatMap((part) => {
		if (!isReadable(part)) {
			return [
				part,
			];
		}
		return next < readable.length
			? [
					readable[next++],
				]
			: [];
	});
	return [
		...merged,
		...readable.slice(next),
	];
};
