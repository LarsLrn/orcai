import type { FileType } from "@orcai/schema";

/**
 * Single source of truth: FileType → canonical MIME type.
 * `satisfies` ensures every FileType variant (except "unknown") has an entry,
 * so adding a new variant to the schema will cause a compile error here.
 */
const FILE_TYPE_TO_MIME = {
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
	md: "text/markdown",
	txt: "text/plain",
	csv: "text/csv",
	pdf: "application/pdf",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	mp3: "audio/mpeg",
	wav: "audio/wav",
	mp4: "video/mp4",
	mov: "video/quicktime",
} as const satisfies Record<Exclude<FileType, "unknown">, string>;

// Reverse lookup built from FILE_TYPE_TO_MIME (first FileType per MIME wins)
const MIME_TO_FILE_TYPE = new Map<string, FileType>();
for (const [fileType, mime] of Object.entries(FILE_TYPE_TO_MIME)) {
	if (!MIME_TO_FILE_TYPE.has(mime)) {
		MIME_TO_FILE_TYPE.set(mime, fileType as FileType);
	}
}
// Non-standard MIME aliases
MIME_TO_FILE_TYPE.set("image/jpg", "jpg");
MIME_TO_FILE_TYPE.set("audio/x-wav", "wav");

export function getFileTypeFromMime(mimeType: string): FileType {
	for (const [mime, fileType] of MIME_TO_FILE_TYPE) {
		if (mimeType.startsWith(mime)) {
			return fileType;
		}
	}
	return "unknown";
}

export function getMimeTypeFromFileType(
	fileType: FileType,
): string | undefined {
	if (fileType === "unknown") return undefined;
	return FILE_TYPE_TO_MIME[fileType];
}
