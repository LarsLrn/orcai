import { expect, test } from "bun:test";
import { createHash, randomBytes } from "node:crypto";
import { buckets } from "@orcai/core";
import * as Effect from "effect/Effect";
import {
	getSignedPartUploadUrl,
	isS3NotFound,
	S3Live,
	type S3Service,
	sendAbortMultipartUploadCommand,
	sendCompleteMultipartUploadCommand,
	sendCreateMultipartUploadCommand,
	sendDeleteObjectCommand,
	sendGetObjectCommand,
	sendHeadObjectCommand,
} from "../src/server";

/** The smallest part S3 accepts for any but the last part. */
const MIN_PART_SIZE = 5 * 1024 * 1024;
const bucket = buckets.main.name;

type Upload = {
	key: string;
	uploadId: string;
};

/**
 * Runs `use` on a new upload under the staging prefix, then aborts the
 * upload and deletes its object whatever `use` left behind.
 */
const withUpload = <A, E, R>(use: (upload: Upload) => Effect.Effect<A, E, R>) =>
	Effect.gen(function* () {
		const key = `staging/multipart-test/${crypto.randomUUID()}.bin`;
		const { UploadId } = yield* sendCreateMultipartUploadCommand({
			bucket,
			key,
			contentType: "application/octet-stream",
			metadata: {},
		});
		if (!UploadId) return yield* Effect.die("Storage returned no upload ID");
		const upload = {
			key,
			uploadId: UploadId,
		};
		return yield* use(upload).pipe(
			Effect.ensuring(
				Effect.all([
					sendAbortMultipartUploadCommand({
						bucket,
						...upload,
					}).pipe(Effect.ignore),
					sendDeleteObjectCommand({
						bucket,
						key,
					}).pipe(Effect.ignore),
				]),
			),
		);
	});

/** Sends a part the way a browser does, through its signed URL. */
const putPart = (
	upload: Upload,
	partNumber: number,
	body: Uint8Array<ArrayBuffer>,
) =>
	Effect.gen(function* () {
		const signedUrl = yield* getSignedPartUploadUrl({
			bucket,
			key: upload.key,
			uploadId: upload.uploadId,
			partNumber,
			contentLength: body.byteLength,
		});
		const response = yield* Effect.promise(() =>
			fetch(signedUrl, {
				method: "PUT",
				body,
			}),
		);
		const etag = response.headers.get("ETag");
		if (!response.ok || !etag)
			return yield* Effect.die(
				`Part ${partNumber} answered ${response.status}`,
			);
		return {
			ETag: etag,
			PartNumber: partNumber,
		};
	});

const sha256 = (bytes: Uint8Array) =>
	createHash("sha256").update(bytes).digest("hex");

const run = <A, E>(effect: Effect.Effect<A, E, S3Service>) =>
	Effect.runPromise(effect.pipe(Effect.provide(S3Live)));

test("a completed upload reads back as the bytes of its parts", async () => {
	const bytes = new Uint8Array(randomBytes(MIN_PART_SIZE + 1234));
	const stored = await run(
		withUpload((upload) =>
			Effect.gen(function* () {
				const parts = yield* Effect.all(
					[
						putPart(upload, 1, bytes.subarray(0, MIN_PART_SIZE)),
						putPart(upload, 2, bytes.subarray(MIN_PART_SIZE)),
					],
					{
						concurrency: 2,
					},
				);
				yield* sendCompleteMultipartUploadCommand({
					bucket,
					key: upload.key,
					uploadId: upload.uploadId,
					parts,
				});
				const object = yield* sendGetObjectCommand({
					bucket,
					key: upload.key,
				});
				return yield* Effect.promise(
					async () => (await object.Body?.transformToByteArray()) ?? null,
				);
			}),
		),
	);

	expect(stored?.byteLength).toBe(bytes.byteLength);
	expect(stored && sha256(stored)).toBe(sha256(bytes));
}, 30_000);

test("an aborted upload can no longer be completed and leaves no object", async () => {
	const { completion, head } = await run(
		withUpload((upload) =>
			Effect.gen(function* () {
				const part = yield* putPart(
					upload,
					1,
					new Uint8Array(randomBytes(MIN_PART_SIZE)),
				);
				yield* sendAbortMultipartUploadCommand({
					bucket,
					key: upload.key,
					uploadId: upload.uploadId,
				});
				const completion = yield* sendCompleteMultipartUploadCommand({
					bucket,
					key: upload.key,
					uploadId: upload.uploadId,
					parts: [
						part,
					],
				}).pipe(Effect.flip);
				const head = yield* sendHeadObjectCommand({
					bucket,
					key: upload.key,
				}).pipe(Effect.flip);
				return {
					completion,
					head,
				};
			}),
		),
	);

	expect(isS3NotFound(completion)).toBe(true);
	expect(isS3NotFound(head)).toBe(true);
}, 30_000);
