import type { FileType } from "@/types/file";

function createAbortHandler(
	xhr: XMLHttpRequest,
	reject: (reason?: any) => void,
) {
	return () => {
		xhr.abort();
		reject(new Error("Upload aborted."));
	};
}

export async function uploadFileToS3(params: {
	signedUrl: string;
	file: File;
	objectMetadata: Record<string, string>;
	onProgress?: (progress: number) => void;
	signal?: AbortSignal;
}) {
	const xhr = new XMLHttpRequest();

	await new Promise<void>((resolve, reject) => {
		const abortHandler = createAbortHandler(xhr, reject);

		if (params.signal?.aborted) {
			abortHandler();
		}

		params.signal?.addEventListener("abort", abortHandler);

		xhr.onloadend = () => {
			params.signal?.removeEventListener("abort", abortHandler);

			if (xhr.readyState === 4 && xhr.status === 200) {
				params.onProgress?.(1);

				resolve();
			} else {
				reject(new Error("Failed to upload file to S3."));
			}
		};

		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) {
				params.onProgress?.(Math.min(event.loaded / event.total, 0.99));
			}
		};

		xhr.open("PUT", params.signedUrl, true);
		xhr.setRequestHeader("Content-Type", params.file.type);

		Object.entries(params.objectMetadata).forEach(([key, value]) => {
			xhr.setRequestHeader(`x-amz-meta-${key}`, value);
		});

		xhr.send(params.file);
	});
}

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
