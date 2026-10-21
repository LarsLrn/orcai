/** Where a compaction came from: a provider's server or our own summary. */
export type CompactionSource = "anthropic" | "openai" | "summary";

/** The provider metadata of our own summary's text part. */
export const SUMMARY_METADATA = {
	orcai: {
		type: "compaction",
	},
} as const;

/** A stored message part, typed structurally so every message type fits. */
export interface StoredPart {
	readonly type: string;
	readonly text?: string;
	readonly kind?: string;
	readonly providerMetadata?: unknown;
}

const metadataType = (metadata: unknown, provider: string) => {
	const entry =
		typeof metadata === "object" && metadata !== null
			? (metadata as Record<string, unknown>)[provider]
			: undefined;
	return typeof entry === "object" && entry !== null
		? (entry as Record<string, unknown>).type
		: undefined;
};

/**
 * Where a stored part compacts the conversation, if it does: an Anthropic
 * compaction block, an OpenAI compaction item or our own summary. A summary
 * still streaming may be empty.
 */
export const compactionSource = (
	part: StoredPart,
): CompactionSource | undefined => {
	if (part.type === "custom") {
		return part.kind === "openai.compaction" ? "openai" : undefined;
	}
	if (part.type !== "text") {
		return undefined;
	}
	if (metadataType(part.providerMetadata, "anthropic") === "compaction") {
		return "anthropic";
	}
	return metadataType(part.providerMetadata, "orcai") === "compaction"
		? "summary"
		: undefined;
};

export const isCompactionPart = (part: StoredPart) =>
	compactionSource(part) !== undefined;

/** The latest compaction a turn reads in `messages`: everything before it is summarized. */
export const compactionPoint = (
	messages: readonly {
		parts: readonly StoredPart[];
	}[],
	reads: (source: CompactionSource) => boolean,
):
	| {
			message: number;
			part: number;
			source: CompactionSource;
	  }
	| undefined => {
	for (let message = messages.length - 1; message >= 0; message--) {
		const { parts } = messages[message];
		for (let part = parts.length - 1; part >= 0; part--) {
			const source = compactionSource(parts[part]);
			if (
				source !== undefined &&
				reads(source) &&
				(parts[part].type === "custom" || parts[part].text)
			) {
				return {
					message,
					part,
					source,
				};
			}
		}
	}
	return undefined;
};
