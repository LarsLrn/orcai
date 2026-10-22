/** An http(s) URL whose host is one of `allowedDomains` or below one; any such URL when the list is empty. */
export const isAllowedUrl = (
	url: string,
	allowedDomains: readonly string[],
): boolean => {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		return false;
	}
	if (allowedDomains.length === 0) {
		return true;
	}
	const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
	return allowedDomains.some((domain) => {
		const allowed = domain.toLowerCase();
		return host === allowed || host.endsWith(`.${allowed}`);
	});
};
