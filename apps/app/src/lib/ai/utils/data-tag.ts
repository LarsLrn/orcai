import { SOURCE_REF } from "@/lib/ai/citations/source-ref";

const escapeAttribute = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");

/** A well-formed ref goes without quotes, as the model writes it in `<cite>`. */
const attribute = (key: string, value: string) =>
	key === "ref" && SOURCE_REF.test(value)
		? ` ${key}=${value}`
		: ` ${key}="${escapeAttribute(value)}"`;

/**
 * Untrusted text in a tag the system prompt calls data. Attribute values are
 * escaped, and the text cannot close the tag.
 */
export const dataTag = (
	name: string,
	attributes: Record<string, string | undefined>,
	text: string,
) =>
	[
		`<${name}${Object.entries(attributes)
			.flatMap(([key, value]) =>
				value === undefined
					? []
					: [
							attribute(key, value),
						],
			)
			.join("")}>`,
		text.replace(new RegExp(`</${name}`, "gi"), `&lt;/${name}`),
		`</${name}>`,
	].join("\n");
