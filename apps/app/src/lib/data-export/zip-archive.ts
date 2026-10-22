import { once } from "node:events";
import { PassThrough } from "node:stream";
import { uploadStream } from "@orcai/s3/server";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { Zip, ZipDeflate, ZipPassThrough } from "fflate";

class ZipArchiveError extends Data.TaggedError("ZipArchiveError")<{
	readonly entry?: string;
	readonly cause: unknown;
}> {}

export interface ZipArchiveWriter {
	/** Adds a compressed text entry. */
	readonly addText: (
		name: string,
		content: string,
	) => Effect.Effect<void, ZipArchiveError>;
	/** Adds an entry stored as is, read chunk by chunk. */
	readonly addFile: (
		name: string,
		chunks: AsyncIterable<Uint8Array>,
	) => Effect.Effect<void, ZipArchiveError>;
}

const encoder = new TextEncoder();

/**
 * Streams a zip archive into S3 while `fill` adds its entries one after the
 * other, and returns its size in bytes. Every entry waits for the upload to
 * catch up, so memory stays at a few upload parts whatever the archive's size.
 */
export const writeZipArchive = <E, R>(
	target: {
		readonly bucket: string;
		readonly key: string;
	},
	fill: (writer: ZipArchiveWriter) => Effect.Effect<void, E, R>,
) =>
	Effect.gen(function* () {
		const body = new PassThrough();
		let size = 0;
		const zip = new Zip((error, chunk, final) => {
			if (error) {
				body.destroy(error);
				return;
			}
			size += chunk.length;
			body.write(chunk);
			if (final) {
				body.end();
			}
		});

		const drained = async (signal: AbortSignal) => {
			if (body.writableNeedDrain) {
				await once(body, "drain", {
					signal,
				});
			}
		};

		const writer: ZipArchiveWriter = {
			addText: (name, content) =>
				Effect.tryPromise({
					try: (signal) => {
						const file = new ZipDeflate(name, {
							level: 6,
						});
						zip.add(file);
						file.push(encoder.encode(content), true);
						return drained(signal);
					},
					catch: (cause) =>
						new ZipArchiveError({
							entry: name,
							cause,
						}),
				}),
			addFile: (name, chunks) =>
				Effect.tryPromise({
					try: async (signal) => {
						const file = new ZipPassThrough(name);
						zip.add(file);
						for await (const chunk of chunks) {
							file.push(chunk);
							await drained(signal);
						}
						file.push(new Uint8Array(0), true);
						await drained(signal);
					},
					catch: (cause) =>
						new ZipArchiveError({
							entry: name,
							cause,
						}),
				}),
		};

		const write = fill(writer).pipe(
			Effect.andThen(
				Effect.try({
					try: () => zip.end(),
					catch: (cause) =>
						new ZipArchiveError({
							cause,
						}),
				}),
			),
			Effect.onError(() =>
				Effect.sync(() => body.destroy(new Error("Archive not completed"))),
			),
		);

		yield* Effect.all(
			[
				uploadStream({
					bucket: target.bucket,
					key: target.key,
					body,
					contentType: "application/zip",
				}),
				write,
			],
			{
				concurrency: "unbounded",
				discard: true,
			},
		);

		return size;
	});
