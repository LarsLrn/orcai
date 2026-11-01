/** `url` when it is an absolute http or https URL without credentials; undefined otherwise. */
export const safeExternalUrl = (url: string): string | undefined => {
	const parsed = URL.parse(url);

	return parsed &&
		(parsed.protocol === "http:" || parsed.protocol === "https:") &&
		parsed.username === "" &&
		parsed.password === ""
		? url
		: undefined;
};
