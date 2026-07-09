import { getFileTypeFromMime } from "@orcai/s3";
import { fileTypeSchema } from "@orcai/schema";

const fileTypeValues = new Set<string>(fileTypeSchema.options);

const getFileTypeLabel = (fileType: string) => {
	const normalized = fileType.trim().toLowerCase();
	const mapped = getFileTypeFromMime(normalized);

	if (mapped !== "unknown") {
		return mapped.toUpperCase();
	}

	if (fileTypeValues.has(normalized)) {
		return normalized.toUpperCase();
	}

	return fileType;
};

export { getFileTypeLabel };
