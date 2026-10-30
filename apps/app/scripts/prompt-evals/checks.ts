import { toolDeclarationOf } from "@/lib/ai/tools/registry";
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

export const answers: CodeCheck = {
	name: "answers in text",
	pass: ({ text }) => text.trim().length > 0,
};

export const mentions = (pattern: RegExp): CodeCheck => ({
	name: `mentions ${pattern}`,
	pass: ({ text }) => pattern.test(text),
});

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

/** The opening tag alone, as the app collects a reply's sources. */
const CITE = /<cite\b[^>]*?\bchunk="([^"]*)"/g;

const citedRefs = (text: string) =>
	[
		...text.matchAll(CITE),
	].map(([, ref]) => ref);

export const cites: CodeCheck = {
	name: "cites with <cite chunk>",
	pass: ({ text }) => citedRefs(text).length > 0,
};

export const citesNothing: CodeCheck = {
	name: "cites nothing",
	pass: ({ text }) => !/<cite\b/.test(text),
};

export const citesOnly = (refs: readonly string[]): CodeCheck => ({
	name: "cites only the refs it was given",
	pass: ({ text }) => citedRefs(text).every((ref) => refs.includes(ref)),
});

/** No footnotes, bracketed refs or Sources section in place of `<cite>`. */
export const noOtherCitationStyle: CodeCheck = {
	name: "uses no other citation style",
	pass: ({ text }) =>
		!/\[\^?\d+\]|\[k[a-z0-9]{6}\]|^#*\s*\**(Sources|References)\**:?\s*$/im.test(
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
