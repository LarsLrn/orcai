import { z } from "zod/v4";
import { displayCallText } from "@/lib/ai/citations/chat-sources";
import { citeTags } from "@/lib/ai/citations/cite-tag";
import { SOURCE_REF } from "@/lib/ai/citations/source-ref";
import { toolDeclarationOf } from "@/lib/ai/tools/registry";
import { searchWebOutputSchema } from "@/lib/ai/tools/web/outputs";
import type { Transcript } from "./harness";

/** A property of a run, graded in code. */
export interface CodeCheck {
	name: string;
	pass: (transcript: Transcript) => boolean;
}

/** A property code cannot grade: the judge model answers `rubric` yes or no about the answer text. */
export interface JudgedCheck {
	name: string;
	rubric: string;
}

export type Check = CodeCheck | JudgedCheck;

export const judged = (name: string, rubric: string): JudgedCheck => ({
	name,
	rubric,
});

const names = ({ calls }: Transcript) => calls.map(({ toolName }) => toolName);

export const calls = (toolName: string): CodeCheck => ({
	name: `calls ${toolName}`,
	pass: (transcript) => names(transcript).includes(toolName),
});

/** A call to `toolName` whose input `fits`, named by what it expects. */
export const callsWith = <Input>(
	toolName: string,
	expected: string,
	fits: (input: Input) => boolean,
): CodeCheck => ({
	name: `calls ${toolName} with ${expected}`,
	pass: ({ calls: made }) =>
		made.some(
			(call) => call.toolName === toolName && fits(call.input as Input),
		),
});

export interface Change {
	toolName: string;
	expected: string;
	fits: (input: never) => boolean;
}

export const change = <Input>(
	toolName: string,
	expected: string,
	fits: (input: Input) => boolean,
): Change => ({
	toolName,
	expected,
	fits: fits as (input: never) => boolean,
});

const changesSomething = (toolName: string) => {
	const kind = toolDeclarationOf(toolName)?.kind;
	return kind === "create" || kind === "change";
};

/**
 * Every call that creates or changes something, and every call to an
 * expected tool, is one of `expected`, and each expected call happens once.
 * A wrong target, role or extra change fails, even beside the right call.
 */
export const changesOnly = (...expected: Change[]): CodeCheck => ({
	name:
		expected.length === 0
			? "changes nothing"
			: `changes only by ${expected.map(({ toolName, expected: what }) => `${toolName} with ${what}`).join(", ")}`,
	pass: ({ calls: made }) => {
		const changing = made.filter(
			({ toolName }) =>
				changesSomething(toolName) ||
				expected.some((call) => call.toolName === toolName),
		);
		return (
			changing.length === expected.length &&
			expected.every(
				({ toolName, fits }) =>
					changing.filter(
						(call) => call.toolName === toolName && fits(call.input as never),
					).length === 1,
			)
		);
	},
});

export const doesNotCall = (...toolNames: string[]): CodeCheck => ({
	name: `does not call ${toolNames.join(", ")}`,
	pass: (transcript) =>
		!names(transcript).some((name) => toolNames.includes(name)),
});

/** `first` is called, and before any of `later`. */
export const callsBefore = (first: string, ...later: string[]): CodeCheck => ({
	name: `calls ${first} before ${later.join(", ")}`,
	pass: (transcript) => {
		const called = names(transcript);
		const index = called.indexOf(first);
		return (
			index !== -1 &&
			called.slice(0, index).every((name) => !later.includes(name))
		);
	},
});

const createsSomething = (toolName: string) =>
	toolDeclarationOf(toolName)?.kind === "create";

/** A create tool is called, and only after `first`. */
export const createsAfter = (first: string): CodeCheck => ({
	name: `creates only after ${first}`,
	pass: (transcript) => {
		const called = names(transcript);
		const index = called.indexOf(first);
		return (
			index !== -1 &&
			called.slice(index + 1).some(createsSomething) &&
			!called.slice(0, index).some(createsSomething)
		);
	},
});

export const answers: CodeCheck = {
	name: "answers in text",
	pass: ({ text }) => text.trim().length > 0,
};

export const mentions = (pattern: RegExp): CodeCheck => ({
	name: `mentions ${pattern}`,
	pass: ({ text }) => pattern.test(text),
});

/** `date`, as the user's local calendar day, in a form an answer may write it. */
export const mentionsDate = (date: Date): CodeCheck => {
	const day = date.getDate();
	const monthNumber = date.getMonth() + 1;
	const month = date.toLocaleString("en", {
		month: "long",
	});
	const year = date.getFullYear();
	const forms = [
		`${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
		`${day}(st|nd|rd|th)?( of)? ${month},? ${year}`,
		`${month} ${day}(st|nd|rd|th)?,? ${year}`,
		`0?${day}\\.\\s?0?${monthNumber}\\.\\s?${year}`,
		`0?${day}/0?${monthNumber}/${year}`,
	];

	return mentions(new RegExp(`(?<!\\d)(${forms.join("|")})(?!\\d)`, "i"));
};

export const omits = (pattern: RegExp): CodeCheck => ({
	name: `omits ${pattern}`,
	pass: ({ text }) => !pattern.test(text),
});

/** Old names the glossary lists under Avoid, which the model must not echo to users. */
const AVOIDED_TERMS =
	/\b(knowledge[- ]bases?|templates?|behaviou?r blocks?|database blocks?|repository blocks?|AI behaviou?rs?|chunks?)\b/i;

export const glossaryTerms: CodeCheck = {
	name: "uses no avoided glossary term",
	pass: ({ text }) => !AVOIDED_TERMS.test(text),
};

const GERMAN =
	/\b(der|die|das|und|ist|nicht|Sie|ich|ein|eine|mit|für|auf|zu|werden|wird|können|kann|oder|auch|sich|dem|den|des)\b/g;
const ENGLISH =
	/\b(the|a|an|and|is|not|you|it|with|for|on|to|be|will|can|or|also|this|that|of|are|your)\b/g;

/** Function words decide the language; a mixed answer fails both. */
const language = (text: string) => {
	const german = text.match(GERMAN)?.length ?? 0;
	const english = text.match(ENGLISH)?.length ?? 0;
	if (german > english * 2) return "de";
	if (english > german * 2) return "en";
	return "mixed";
};

/** A value written in `tag`, for background output fields. */
export const writtenIn = (tag: "en" | "de") => (value: unknown) =>
	typeof value === "string" && language(value) === tag;

export const answersIn = (tag: "en" | "de"): CodeCheck => ({
	name: `answers in ${tag}`,
	// Cited text may quote a source in its own language.
	pass: ({ text }) =>
		language(text.replace(/<cite\b[\s\S]*?<\/cite>|<[^>]+>/g, "")) === tag,
});

/** What an answer cites in, as the app reads it: its text and its display calls. */
const citable = ({ text, calls: made }: Transcript) =>
	[
		text,
		...made
			.filter(({ toolName }) => toolDeclarationOf(toolName)?.kind === "display")
			.map(({ input }) => displayCallText(input)),
	].join("\n");

const tagsOf = (transcript: Transcript) => citeTags(citable(transcript));

const citedRefsOf = (transcript: Transcript) =>
	tagsOf(transcript).flatMap(({ ref }) => (ref === undefined ? [] : ref));

export const cites: CodeCheck = {
	name: "cites with <cite ref>",
	pass: (transcript) => citedRefsOf(transcript).length > 0,
};

/** Each cite has a well-formed ref, cited text and a closing tag. */
export const citesComplete: CodeCheck = {
	name: "writes every cite complete",
	pass: (transcript) =>
		tagsOf(transcript).every(
			({ ref, text }) =>
				ref !== undefined &&
				SOURCE_REF.test(ref) &&
				text !== undefined &&
				text.trim() !== "",
		),
};

export const citesNothing: CodeCheck = {
	name: "cites nothing",
	pass: (transcript) => tagsOf(transcript).length === 0,
};

export const citesAll = (refs: readonly string[]): CodeCheck => ({
	name: "cites every ref it needs",
	pass: (transcript) => {
		const cited = citedRefsOf(transcript);
		return refs.every((ref) => cited.includes(ref));
	},
});

/** Each cited ref names a source a call of the run issued. */
export const citesIssued: CodeCheck = {
	name: "cites only refs its calls issued",
	pass: (transcript) => {
		const issued = new Set(
			transcript.calls.flatMap(({ toolName, output }) =>
				(toolDeclarationOf(toolName)?.sources?.(output) ?? []).map(
					({ ref }) => ref,
				),
			),
		);
		return citedRefsOf(transcript).every((ref) => issued.has(ref));
	},
};

export const citesOnly = (refs: readonly string[]): CodeCheck => ({
	name: "cites only the refs it was given",
	pass: (transcript) =>
		citedRefsOf(transcript).every((ref) => refs.includes(ref)),
});

/** A cite inside a display call's prose, the app's display fields. */
export const citesInDisplay = (refs: readonly string[]): CodeCheck => ({
	name: "cites in a display field",
	pass: ({ calls: made }) =>
		made.some(
			({ toolName, input }) =>
				toolDeclarationOf(toolName)?.kind === "display" &&
				citeTags(displayCallText(input)).some(
					({ ref }) => ref !== undefined && refs.includes(ref),
				),
		),
});

const LEGACY_ATTRIBUTES = new Set([
	"chunk",
	"assetid",
	"asset_id",
	"title",
	"page",
	"pagenumber",
	"page_number",
]);

export const noLegacyCite: CodeCheck = {
	name: "uses no older cite attributes",
	pass: (transcript) =>
		tagsOf(transcript).every(({ attributes }) =>
			attributes.every((name) => !LEGACY_ATTRIBUTES.has(name.toLowerCase())),
		),
};

const docsPageSchema = z.object({
	path: z.string(),
	url: z.string(),
});

/** The pages the run's web searches returned and the docs pages it read, by URL and docs path. */
const resultUrls = ({ calls: made }: Transcript) =>
	made.flatMap(({ toolName, output }) => {
		if (toolName === "searchWeb") {
			return (searchWebOutputSchema.safeParse(output).data?.results ?? []).map(
				({ url }) => url,
			);
		}
		const page =
			toolName === "readDocs"
				? docsPageSchema.safeParse(output).data
				: undefined;
		return page
			? [
					page.url,
					page.path,
				]
			: [];
	});

/** No footnotes, bracketed refs, Sources section or Markdown links to search results or read docs pages in place of `<cite>`. */
export const noOtherCitationStyle: CodeCheck = {
	name: "uses no other citation style",
	pass: (transcript) =>
		!/\[\^?\d+\]|\[[kadw][a-z0-9]{6}\]|^#*\s*\**(Sources|References)\**:?\s*$/im.test(
			transcript.text,
		) &&
		resultUrls(transcript).every(
			(url) =>
				![
					`](${url})`,
					`](${url} `,
					`](<${url}>`,
				].some((link) => transcript.text.includes(link)),
		),
};

/** No line that opens a list of sources, as a heading or a label, in English or German. */
export const noSourceList: CodeCheck = {
	name: "writes no source list",
	pass: ({ text }) =>
		!/^[#>*_\s-]*(Sources?|References?|Quellen(angaben|verzeichnis)?|Quelle|Literatur(verzeichnis)?|Referenzen)[*_\s]*(:|$)/im.test(
			text,
		),
};

/** A field of a background run's parsed output. */
export const outputField = (
	name: string,
	matches: (value: unknown) => boolean,
): CodeCheck => ({
	name: `output ${name}`,
	pass: ({ output }) =>
		typeof output === "object" &&
		output !== null &&
		matches(fieldOf(output, name)),
});

const fieldOf = (output: object, name: string): unknown => {
	const record = output as Record<string, unknown>;
	if (name in record) {
		return record[name];
	}
	const metadata = record.metadata;
	return typeof metadata === "object" && metadata !== null
		? (metadata as Record<string, unknown>)[name]
		: undefined;
};

/** The title a background run stored, after the app's clean-up. */
export const titleOf = (
	check: (title: string) => boolean,
	name: string,
): CodeCheck => ({
	name: `title ${name}`,
	pass: ({ output }) => typeof output === "string" && check(output),
});
