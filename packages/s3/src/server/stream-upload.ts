import { Upload } from "@aws-sdk/lib-storage";
import * as Effect from "effect/Effect";
import { S3Error } from "./errors";
import { S3Service } from "./service";

/**
 * Uploads a body of unknown length in multipart parts, holding a few parts in
 * memory at most. Interruption aborts the upload.
 */
export const uploadStream = (params: {
	bucket: string;
	key: string;
	body: ReadableStream<Uint8Array>;
	contentType: string;
}) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		return yield* Effect.tryPromise({
			try: (signal) => {
				const upload = new Upload({
					client,
					params: {
						Bucket: params.bucket,
						Key: params.key,
						Body: params.body,
						ContentType: params.contentType,
					},
				});
				signal.addEventListener("abort", () => {
					void upload.abort();
				});
				return upload.done();
			},
			catch: (cause) =>
				new S3Error({
					operation: "uploadStream",
					cause,
				}),
		});
	});
