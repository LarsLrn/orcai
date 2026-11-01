import {
	type ChatMessageCitation,
	chatMessageCitationSchema,
} from "@orcai/schema";
import { toolDeclarationOf, toolKindOf } from "@/lib/ai/tools/registry";
import { citedRefs } from "./cite-tag";
import type { Source } from "./source-ref";

/** Sources by the refs that name them. */
export type Citations = Record<string, ChatMessageCitation>;

/** Citations as a reply streams them, which the client merges: null withdraws one. */
export type StreamedCitations = Record<string, ChatMessageCitation | null>;

type Part = {
	type: string;
};

/** The strings of a value, at any depth. */
const stringsOf = (value: unknown): string[] => {
	if (typeof value === "string") {
		return [
			value,
		];
	}
	if (Array.isArray(value)) {
		return value.flatMap(stringsOf);
	}
	return typeof value === "object" && value !== null
		? Object.values(value).flatMap(stringsOf)
		: [];
};

/** What may cite: a display call's strings, so its prose fields. */
export const displayCallText = (input: unknown, output?: unknown) =>
	stringsOf([
		input,
		output,
	]).join("\n");

/** The text a reply's parts may cite in: its text and its display calls. */
export const citableText = (parts: readonly Part[]) =>
	parts
		.flatMap((part) => {
			if (part.type === "text" && "text" in part) {
				return stringsOf(part.text);
			}
			return toolKindOf(part) === "display"
				? [
						displayCallText(
							"input" in part ? part.input : undefined,
							"output" in part ? part.output : undefined,
						),
					]
				: [];
		})
		.join("\n");

/** The sources a stored tool part issued; none until it has an output. */
const partSources = (part: Part): Source[] =>
	part.type.startsWith("tool-") &&
	"state" in part &&
	part.state === "output-available" &&
	"output" in part
		? callSources(part.type.slice("tool-".length), part.output)
		: [];

const callSources = (toolName: string, output: unknown): Source[] => {
	try {
		return toolDeclarationOf(toolName)?.sources?.(output) ?? [];
	} catch {
		return [];
	}
};

const hasPage = ({ citation }: Source) =>
	citation.kind === "asset" && citation.page !== undefined;

/**
 * Every source a chat issued: those of its stored messages, and those its
 * turn records as calls finish. A ref two identities claim is ambiguous and
 * names nothing.
 */
export const chatSources = (
	history: readonly {
		parts: readonly Part[];
	}[],
) => {
	const sources = new Map<string, Source>();
	const ambiguous = new Map<string, Set<string>>();

	const add = (source: Source) => {
		if (!chatMessageCitationSchema.safeParse(source.citation).success) {
			return;
		}
		const claimed = ambiguous.get(source.ref);
		if (claimed) {
			claimed.add(source.identity);
			return;
		}
		const known = sources.get(source.ref);
		if (known && known.identity !== source.identity) {
			sources.delete(source.ref);
			ambiguous.set(
				source.ref,
				new Set([
					known.identity,
					source.identity,
				]),
			);
			return;
		}
		// A passage read on one page names the page.
		if (!known || (!hasPage(known) && hasPage(source))) {
			sources.set(source.ref, source);
		}
	};

	for (const { parts } of history) {
		for (const part of parts) {
			partSources(part).forEach(add);
		}
	}

	return {
		/** Adds the sources of a call that finished this turn. */
		record: (toolName: string, output: unknown) => {
			callSources(toolName, output).forEach(add);
		},
		/** The identity a ref names; undefined for an unknown or ambiguous ref. */
		identityOf: (ref: string) => sources.get(ref)?.identity,
		/** The sources of the refs `text` cites that name one. */
		citations: (text: string): Citations =>
			Object.fromEntries(
				[
					...citedRefs(text),
				].flatMap((ref) => {
					const source = sources.get(ref);

					return source
						? [
								[
									ref,
									source.citation,
								] as const,
							]
						: [];
				}),
			),
		/** The ambiguous refs and the identities that claim each. */
		collisions: () =>
			Array.from(ambiguous, ([ref, identities]) => ({
				ref,
				identities: [
					...identities,
				],
			})),
	};
};

export type ChatSources = ReturnType<typeof chatSources>;
