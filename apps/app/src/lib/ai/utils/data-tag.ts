const escapeAttribute = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");

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
							` ${key}="${escapeAttribute(value)}"`,
						],
			)
			.join("")}>`,
		text.replace(new RegExp(`</${name}`, "gi"), `&lt;/${name}`),
		`</${name}>`,
	].join("\n");
