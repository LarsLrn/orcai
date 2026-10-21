import type { ChatMessageCitation, ChatMessageMetadata } from "@orcai/schema";
import { passagesOf, passagesOfParts } from "./outputs";
import type { Passage } from "./types";

/** Sources by chunk ref. */
export type Citations = Record<string, ChatMessageCitation>;

const CITE_CHUNK = /<cite\b[^>]*?\bchunk="([^"]*)"/g;

/** The refs `text` cites with `<cite chunk>`. */
const citedRefs = (text: string) =>
	new Set(Array.from(text.matchAll(CITE_CHUNK), ([, ref]) => ref));

/** The source of each passage's ref; a ref read on one page names the page. */
const passageCitations = (passages: Passage[]): Citations => {
	const citations: Citations = {};
	for (const { ref, assetId, title, pageStart, pageEnd } of passages) {
		if (citations[ref]?.page !== undefined) {
			continue;
		}
		citations[ref] = {
			assetId,
			title,
			...(pageStart !== undefined &&
				pageStart === pageEnd && {
					page: pageStart,
				}),
		};
	}
	return citations;
};

/** The sources of the refs `text` cites; a ref none of `passages` carries is left out. */
const replyCitations = (
	text: string,
	passages: Passage[],
): Citations | undefined => {
	const known = passageCitations(passages);
	const cited = [
		...citedRefs(text),
	].filter((ref) => Object.hasOwn(known, ref));

	return cited.length > 0
		? Object.fromEntries(
				cited.map((ref) => [
					ref,
					known[ref],
				]),
			)
		: undefined;
};

/** A reply's citations: those its turn stored, or while it streams, those of its own calls. */
export const messageCitations = (message: {
	parts: readonly {
		type: string;
	}[];
	metadata?: ChatMessageMetadata;
}): Citations => ({
	...passageCitations(passagesOfParts(message.parts)),
	...message.metadata?.citations,
});

const textOf = (
	parts: readonly {
		type: string;
	}[],
) =>
	parts.flatMap((part) =>
		part.type === "text" && "text" in part && typeof part.text === "string"
			? [
					part.text,
				]
			: [],
	);

/**
 * What a turn's reply cites, from the passages of its prompt and its steps.
 * The prompt holds the reply itself when the turn continues it.
 */
export const turnCitations = ({
	prompt,
	replyId,
	steps,
}: {
	prompt: readonly {
		id: string;
		parts: readonly {
			type: string;
		}[];
	}[];
	replyId: string;
	steps: readonly {
		text: string;
		toolResults: readonly {
			toolName: string;
			output: unknown;
		}[];
	}[];
}) =>
	replyCitations(
		[
			...prompt
				.filter(({ id }) => id === replyId)
				.flatMap(({ parts }) => textOf(parts)),
			...steps.map(({ text }) => text),
		].join("\n"),
		[
			...prompt.flatMap(({ parts }) => passagesOfParts(parts)),
			...steps.flatMap(({ toolResults }) =>
				toolResults.flatMap(({ toolName, output }) =>
					passagesOf(toolName, output),
				),
			),
		],
	);
