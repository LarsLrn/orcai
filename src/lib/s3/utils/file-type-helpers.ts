import type { FileType } from "@/lib/s3/schema/file-schema";

export function getFileTypeFromMime(mimeType: File["type"]): FileType {
	if (mimeType.startsWith("image/jpeg")) {
		return "jpeg";
	}
	if (mimeType.startsWith("image/jpg")) {
		return "jpg";
	}
	if (mimeType.startsWith("image/png")) {
		return "png";
	}
	if (mimeType.startsWith("image/gif")) {
		return "gif";
	}
	if (mimeType.startsWith("image/webp")) {
		return "webp";
	}
	if (mimeType.startsWith("text/markdown")) {
		return "md";
	}
	if (mimeType.startsWith("text/plain")) {
		return "txt";
	}
	if (mimeType.startsWith("text/csv")) {
		return "csv";
	}
	if (mimeType.startsWith("application/pdf")) {
		return "pdf";
	}
	if (
		mimeType ===
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	) {
		return "docx";
	}
	if (
		mimeType ===
		"application/vnd.openxmlformats-officedocument.presentationml.presentation"
	) {
		return "pptx";
	}
	if (mimeType === "audio/mpeg") {
		return "mp3";
	}
	if (mimeType === "audio/wav" || mimeType === "audio/x-wav") {
		return "wav";
	}
	if (mimeType === "video/mp4") {
		return "mp4";
	}
	if (mimeType === "video/quicktime") {
		return "mov";
	}
	return "unknown";
}
