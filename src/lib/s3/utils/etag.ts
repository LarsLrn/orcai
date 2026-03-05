export const ensureQuotedEtag = (etag: string) => {
	const trimmed = etag.trim();

	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return trimmed;
	}

	return `"${trimmed.replace(/"/g, "")}"`;
};
