import { describe, expect, test } from "bun:test";
import {
	BlobReader,
	TextWriter,
	ZipReader,
} from "@zip.js/zip.js/index-native.js";
import * as Effect from "effect/Effect";
import { writeZip } from "./zip-archive";

const collectingSink = () => {
	const chunks: Uint8Array<ArrayBuffer>[] = [];
	return {
		sink: new WritableStream<Uint8Array>({
			write: (chunk) => {
				chunks.push(chunk.slice());
			},
		}),
		archive: () => new Blob(chunks),
	};
};

/** Generates `count` copies of `chunk` without holding more than one. */
const repeated = (chunk: Uint8Array, count: number) => {
	let sent = 0;
	return new ReadableStream<Uint8Array>({
		pull: (controller) => {
			if (sent++ < count) {
				controller.enqueue(chunk);
			} else {
				controller.close();
			}
		},
	});
};

describe("writeZip", () => {
	test("writes text and file entries a zip reader reads back", async () => {
		const { sink, archive } = collectingSink();
		const file = new TextEncoder().encode("field notes");

		const size = await Effect.runPromise(
			writeZip(sink, (writer) =>
				Effect.gen(function* () {
					yield* writer.addText("profile.json", '{"name":"Ada"}');
					yield* writer.addFile("files/notes.txt", repeated(file, 2));
				}),
			),
		);

		const blob = archive();
		expect(size).toBe(blob.size);
		const reader = new ZipReader(new BlobReader(blob));
		const entries = await reader.getEntries();
		const contents = await Promise.all(
			entries.map(async (entry) => [
				entry.filename,
				entry.directory ? "" : await entry.getData(new TextWriter()),
			]),
		);
		expect(contents).toEqual([
			[
				"profile.json",
				'{"name":"Ada"}',
			],
			[
				"files/notes.txt",
				"field notesfield notes",
			],
		]);
		await reader.close();
	});

	test("fails and aborts the sink when filling fails", async () => {
		let aborted: unknown;
		const sink = new WritableStream<Uint8Array>({
			abort: (reason) => {
				aborted = reason;
			},
		});

		const exit = await Effect.runPromiseExit(
			writeZip(sink, (writer) =>
				writer.addText("a.txt", "a").pipe(Effect.andThen(Effect.fail("boom"))),
			),
		);

		expect(exit._tag).toBe("Failure");
		expect(aborted).toBeInstanceOf(Error);
	});

	test("reads a file entry only as fast as the sink takes it", async () => {
		const chunk = new Uint8Array(1024 * 1024).fill(7);
		const entrySize = chunk.length * 64;
		let read = 0;
		let taken = 0;
		let lead = 0;
		const file = new ReadableStream<Uint8Array>({
			pull: (controller) => {
				if (read === entrySize) {
					controller.close();
					return;
				}
				read += chunk.length;
				lead = Math.max(lead, read - taken);
				controller.enqueue(chunk);
			},
		});
		const slowSink = new WritableStream<Uint8Array>({
			write: async (written) => {
				await new Promise((resolve) => setTimeout(resolve));
				taken += written.length;
			},
		});

		const size = await Effect.runPromise(
			writeZip(slowSink, (writer) => writer.addFile("big.bin", file)),
		);

		expect(size).toBe(taken);
		expect(size).toBeGreaterThan(entrySize);
		expect(lead).toBeLessThan(entrySize / 4);
	});
});
