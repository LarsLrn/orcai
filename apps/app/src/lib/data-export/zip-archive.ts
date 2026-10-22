import { uploadStream } from "@orcai/s3/server";
import { TextReader, ZipWriter } from "@zip.js/zip.js/index-native.js";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";

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
		content: ReadableStream<Uint8Array>,
	) => Effect.Effect<void, ZipArchiveError>;
}

/**
 * Writes a zip archive into `sink` while `fill` adds its entries one after the
 * other, and returns its size in bytes. Every write waits for the sink, so
 * memory stays bounded whatever the archive's size; entries and archives over
 * 4 GB use Zip64.
 */
export const writeZip = <E, R>(
	sink: WritableStream<Uint8Array>,
	fill: (writer: ZipArchiveWriter) => Effect.Effect<void, E, R>,
) =>
	Effect.gen(function* () {
		const output = sink.getWriter();
		let size = 0;
		const zip = new ZipWriter(
			new WritableStream<Uint8Array>({
				write: (chunk) => {
					size += chunk.length;
					return output.write(chunk);
				},
				close: () => output.close(),
			}),
			{
				useWebWorkers: false,
			},
		);

		const add = (
			name: string,
			reader: TextReader | ReadableStream<Uint8Array>,
			level: number,
		) =>
			Effect.tryPromise({
				try: (signal) =>
					zip.add(name, reader, {
						level,
						signal,
					}),
				catch: (cause) =>
					new ZipArchiveError({
						entry: name,
						cause,
					}),
			});

		const writer: ZipArchiveWriter = {
			addText: (name, content) => add(name, new TextReader(content), 6),
			addFile: (name, content) => add(name, content, 0),
		};

		yield* fill(writer).pipe(
			Effect.andThen(
				Effect.tryPromise({
					try: () => zip.close(),
					catch: (cause) =>
						new ZipArchiveError({
							cause,
						}),
				}),
			),
			Effect.onError(() =>
				Effect.promise(() => output.abort(new Error("Archive not completed"))),
			),
		);

		return size;
	});

/** Streams a zip archive into S3, see {@link writeZip}. */
export const writeZipArchive = <E, R>(
	target: {
		readonly bucket: string;
		readonly key: string;
	},
	fill: (writer: ZipArchiveWriter) => Effect.Effect<void, E, R>,
) =>
	Effect.gen(function* () {
		const { readable, writable } = new TransformStream<
			Uint8Array,
			Uint8Array
		>();
		const [, size] = yield* Effect.all(
			[
				uploadStream({
					bucket: target.bucket,
					key: target.key,
					body: readable,
					contentType: "application/zip",
				}),
				writeZip(writable, fill),
			],
			{
				concurrency: "unbounded",
			},
		);
		return size;
	});
