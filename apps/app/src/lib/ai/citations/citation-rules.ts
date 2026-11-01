/** The kinds of source a turn's answers can cite, each named by the tag its data arrives in. */
const CITABLE = {
	passage: {
		tag: "<passage>",
		// sourceRef("passage", "3f2b8c1e-5d4a-4e7b-9c3a-1f6e2d8b7a90")
		example:
			"For a work with three or more authors, <cite ref=kgol9ts>give only the first author's surname followed by et al.</cite>",
	},
	web: {
		tag: "<web-result>",
		// sourceRef("web", "https://www.who.int/news-room/fact-sheets/detail/malaria")
		example:
			"Malaria <cite ref=w2jpxug>is a life-threatening disease that some types of mosquitoes spread to people</cite>.",
	},
} as const;

export type CitableKind = keyof typeof CITABLE;

const exampleRef = (example: string) => /<cite ref=(\w+)>/.exec(example)?.[1];

/**
 * The Citations section for the kinds of source this turn can cite; none
 * without any. Its one rule and its example cover each kind present.
 */
export const citationRules = (kinds: readonly CitableKind[]) => {
	if (kinds.length === 0) {
		return undefined;
	}
	const [first] = kinds;
	const ref = exampleRef(CITABLE[first].example);
	const tags = kinds.map((kind) => CITABLE[kind].tag).join(" and ");

	return [
		"Citations:",
		`- Each ${tags} tag carries a ref, such as ref=${ref}. Cite every sentence that uses one by wrapping the words it supports in a cite tag with that ref, written without quotes: <cite ref=${ref}>the sentence or clause it supports</cite>. Put the opening tag right before those words and </cite> right after them, since the app shows the wrapped words with their source.`,
		"- Cite only refs of tags you were given in this conversation, and only for what those sources say.",
		"- Cite in this form only, since the app renders no footnotes, bracketed numbers or source lists.",
		"",
		"<example>",
		...kinds.map((kind) => CITABLE[kind].example),
		"</example>",
	].join("\n");
};
