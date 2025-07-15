import type { FileType } from "@/types/file";

export const uploadToS3 = (
	presignedUrl: string,
	file: File,
	onProgress?: (progress: number) => void,
	timeoutMs: number = 5 * 60 * 1000, // Default 5 minutes
): { promise: Promise<Response>; xhr: XMLHttpRequest } => {
	const xhr = new XMLHttpRequest();

	// Set timeout (5 minutes by default)
	xhr.timeout = timeoutMs;

	const promise = new Promise<Response>((resolve, reject) => {
		xhr.upload.addEventListener("progress", (event) => {
			if (event.lengthComputable && onProgress) {
				const progress = (event.loaded / event.total) * 100;
				onProgress(progress);
			}
		});

		xhr.addEventListener("load", () => {
			if (xhr.status === 200) {
				resolve(new Response(xhr.response, { status: xhr.status }));
			} else {
				reject(new Error(`Upload failed with status ${xhr.status}`));
			}
		});

		xhr.addEventListener("error", () => {
			reject(new Error("Network error during upload"));
		});

		xhr.addEventListener("timeout", () => {
			reject(new Error(`Upload timeout after ${timeoutMs / 1000} seconds`));
		});

		xhr.addEventListener("abort", () => {
			reject(new Error("Upload was cancelled"));
		});

		xhr.open("PUT", presignedUrl);
		xhr.setRequestHeader("Content-Type", file.type);
		xhr.send(file);
	});

	return { promise, xhr };
};

export function getFileTypeFromMime(mimeType: File["type"]): FileType {
	if (mimeType.startsWith("image/jpeg")) {
		return "jpeg";
		/* } else if (mimeType.startsWith("video/")) {
    return "video"; */
	}
	if (mimeType.startsWith("image/png")) {
		return "png";
	}
	if (mimeType.startsWith("text/markdown")) {
		return "md";
	}
	if (mimeType.startsWith("application/pdf")) {
		return "pdf";
	}
	return "unknown";
}
