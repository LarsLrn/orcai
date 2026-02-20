import { ensureQuotedEtag } from "./utils/utils";

export async function uploadFileToS3(params: {
	signedUrl: string;
	file: File;
	onProgress?: (progress: number) => void;
	signal?: AbortSignal;
	// Optional: headers provided by your server (only those included in the signature)
	signedHeaders?: Record<string, string>;
}) {
	const xhr = new XMLHttpRequest();

	await new Promise<void>((resolve, reject) => {
		const abortHandler = () => {
			xhr.abort();
			reject(new DOMException("Upload aborted", "AbortError"));
		};

		if (params.signal?.aborted) abortHandler();
		params.signal?.addEventListener("abort", abortHandler);

		xhr.onloadend = () => {
			params.signal?.removeEventListener("abort", abortHandler);
			const ok =
				xhr.readyState === 4 && (xhr.status === 200 || xhr.status === 204);
			if (ok) {
				params.onProgress?.(1);
				resolve();
			} else {
				reject(
					new Error(
						`Failed to upload: ${xhr.status} ${xhr.statusText} — ${xhr.responseText || ""}`,
					),
				);
			}
		};

		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable)
				params.onProgress?.(Math.min(e.loaded / e.total, 0.99));
		};

		xhr.open("PUT", params.signedUrl, true);
		// Always set Content-Type if it was part of the presign (common case)
		xhr.setRequestHeader(
			"Content-Type",
			params.file.type || "application/octet-stream",
		);

		// Only set headers that your server told you to set (and signed)
		if (params.signedHeaders) {
			for (const [k, v] of Object.entries(params.signedHeaders)) {
				xhr.setRequestHeader(k, v);
			}
		}

		xhr.send(params.file);
	});
}

export async function uploadMultipartFileToS3(params: {
	file: File;
	parts: { signedUrl: string; partNumber: number; size: number }[];
	partSize: number;
	partsBatchSize?: number;
	onProgress?: (progress: number) => void;
	signal?: AbortSignal;
}) {
	const uploadedParts: { etag: string; number: number }[] = [];
	const progresses: { [part: number]: number } = {};

	const uploadPromises = params.parts.map((part) => async () => {
		const xhr = new XMLHttpRequest();

		const start = (part.partNumber - 1) * params.partSize;
		const end = Math.min(start + part.size, params.file.size);
		const blob = params.file.slice(start, end);

		await new Promise<void>((resolve, reject) => {
			const abortHandler = createAbortHandler(xhr, reject);

			if (params.signal?.aborted) {
				abortHandler();
			}

			params.signal?.addEventListener("abort", abortHandler);

			xhr.onloadend = () => {
				params.signal?.removeEventListener("abort", abortHandler);

				if (xhr.readyState === 4 && xhr.status === 200) {
					const etag = xhr.getResponseHeader("ETag");
					if (!etag) {
						reject(new Error("Missing ETag in response."));
						return;
					}

					uploadedParts.push({
						etag: ensureQuotedEtag(etag),
						number: part.partNumber,
					});

					resolve();
				} else {
					reject(new Error("Failed to upload part to S3."));
				}
			};

			xhr.upload.onprogress = (event) => {
				if (event.lengthComputable) {
					progresses[part.partNumber] = event.loaded / event.total;

					const totalProgress =
						Object.values(progresses).reduce((acc, curr) => acc + curr, 0) /
						params.parts.length;

					params.onProgress?.(Math.min(totalProgress, 0.99));
				}
			};

			xhr.open("PUT", part.signedUrl, true);

			xhr.send(blob);
		});
	});

	const batchSize = params.partsBatchSize || uploadPromises.length;
	for (let i = 0; i < uploadPromises.length; i += batchSize) {
		await Promise.all(uploadPromises.slice(i, i + batchSize).map((fn) => fn()));
	}

	return uploadedParts
		.sort((a, b) => a.number - b.number)
		.map((part) => ({
			etag: part.etag,
			partNumber: part.number,
		}));
}

function createAbortHandler(
	xhr: XMLHttpRequest,
	reject: (reason?: any) => void,
) {
	return () => {
		xhr.abort();
		reject(new Error("Upload aborted."));
	};
}
