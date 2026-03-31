import { ensureQuotedEtag } from "../shared/etag";

export async function uploadFileToS3(params: {
	signedUrl: string;
	file: File;
	onProgress?: (progress: number) => void;
	signal?: AbortSignal;
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

		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) {
				params.onProgress?.(Math.min(event.loaded / event.total, 0.99));
			}
		};

		xhr.open("PUT", params.signedUrl, true);
		xhr.setRequestHeader(
			"Content-Type",
			params.file.type || "application/octet-stream",
		);

		if (params.signedHeaders) {
			for (const [key, value] of Object.entries(params.signedHeaders)) {
				xhr.setRequestHeader(key, value);
			}
		}

		xhr.send(params.file);
	});
}

export async function uploadMultipartFileToS3(params: {
	file: File;
	parts: {
		signedUrl: string;
		partNumber: number;
		size: number;
	}[];
	partSize: number;
	partsBatchSize?: number;
	onProgress?: (progress: number) => void;
	signal?: AbortSignal;
}) {
	const uploadedParts: {
		etag: string;
		number: number;
	}[] = [];
	const progresses: Record<number, number> = {};

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
						Object.values(progresses).reduce(
							(sum, progress) => sum + progress,
							0,
						) / params.parts.length;

					params.onProgress?.(Math.min(totalProgress, 0.99));
				}
			};

			xhr.open("PUT", part.signedUrl, true);
			xhr.send(blob);
		});
	});

	const batchSize = params.partsBatchSize || uploadPromises.length;
	for (let index = 0; index < uploadPromises.length; index += batchSize) {
		await Promise.all(
			uploadPromises.slice(index, index + batchSize).map((fn) => fn()),
		);
	}

	return uploadedParts
		.sort((left, right) => left.number - right.number)
		.map((part) => ({
			etag: part.etag,
			partNumber: part.number,
		}));
}

function createAbortHandler(
	xhr: XMLHttpRequest,
	reject: (reason?: unknown) => void,
) {
	return () => {
		xhr.abort();
		reject(new Error("Upload aborted."));
	};
}
