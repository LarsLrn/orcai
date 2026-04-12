export const formatPageRange = (params: {
	chunkPageStart?: number;
	chunkPageEnd?: number;
	documentTotalPages?: number;
}) => {
	if (
		typeof params.chunkPageStart !== "number" ||
		typeof params.chunkPageEnd !== "number"
	) {
		return undefined;
	}

	const pageRange =
		params.chunkPageStart === params.chunkPageEnd
			? `${params.chunkPageStart}`
			: `${params.chunkPageStart}-${params.chunkPageEnd}`;

	return typeof params.documentTotalPages === "number"
		? `${pageRange} of ${params.documentTotalPages}`
		: pageRange;
};
