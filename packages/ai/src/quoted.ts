/** A JSON string literal, with the line and C1 control characters JSON leaves raw escaped too. */
export const quoted = (value: string) =>
	JSON.stringify(value).replace(
		/[\u007f-\u009f\u2028\u2029]/g,
		(character) =>
			`\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
	);
