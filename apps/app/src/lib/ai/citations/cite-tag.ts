/** A `<cite>` tag of an answer; `text` is undefined while the tag is not closed. */
export interface CiteTag {
	/** The tag as written, up to its closing tag when it has one. */
	tag: string;
	/** The `ref` attribute, quoted or not; undefined for a tag without one. */
	ref: string | undefined;
	/** Every attribute name, in order. */
	attributes: string[];
	text: string | undefined;
}

/** An opening tag, then its text up to `</cite>` when it closes before the next opening tag. */
const CITE = /<cite\b([^>]*)>(?:((?:(?!<cite\b)[\s\S])*?)<\/cite>)?/g;
const ATTRIBUTE =
	/([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const citeTag = ([tag, attributes = "", text]: RegExpExecArray): CiteTag => {
	const parsed = Array.from(attributes.matchAll(ATTRIBUTE));

	return {
		tag,
		ref: parsed
			.filter(([, name]) => name.toLowerCase() === "ref")
			.map(([, , doubled, single, bare]) => doubled ?? single ?? bare)
			.at(0),
		attributes: parsed.map(([, name]) => name),
		text,
	};
};

/** The cite tags of `text`, in order. */
export const citeTags = (text: string): CiteTag[] =>
	Array.from(text.matchAll(CITE), citeTag);

/** The refs `text` cites, from opening tags, so a ref counts once its tag is written. */
export const citedRefs = (text: string) =>
	new Set(citeTags(text).flatMap(({ ref }) => (ref === undefined ? [] : ref)));

/** `text` with each closed cite tag replaced; an unclosed opening tag stays. */
export const replaceCiteTags = (
	text: string,
	replace: (
		tag: CiteTag & {
			text: string;
		},
	) => string,
) => {
	let replaced = "";
	let end = 0;
	for (const match of text.matchAll(CITE)) {
		const tag = citeTag(match);
		replaced += text.slice(end, match.index);
		replaced +=
			tag.text === undefined
				? tag.tag
				: replace({
						...tag,
						text: tag.text,
					});
		end = match.index + tag.tag.length;
	}

	return replaced + text.slice(end);
};
