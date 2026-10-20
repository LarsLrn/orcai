/** Prefixes every line, leaving blank lines without trailing spaces. */
export const indent = (text: string, prefix: string) =>
	text
		.split("\n")
		.map((line) => (line === "" ? prefix.trimEnd() : `${prefix}${line}`))
		.join("\n");
