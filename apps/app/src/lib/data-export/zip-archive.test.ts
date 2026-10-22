import { describe, expect, test } from "bun:test";
import {
	BlobReader,
	TextWriter,
	ZipReader,
} from "@zip.js/zip.js/index-native.js";
import { hash } from "bun";
import * as Effect from "effect/Effect";
import { writeZip } from "./zip-archive";

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const ZIP64_END = 0x06064b50;
const ZIP64_LOCATOR = 0x07064b50;
const MAX_32 = 0xffffffff;

/** Keeps the size, the archive's tail and where each local header starts. */
const recordingSink = (tailBytes: number) => {
	const recording = {
		size: 0,
		tail: new Uint8Array(0),
		localHeaders: [] as number[],
	};
	const sink = new WritableStream<Uint8Array>({
		write: (chunk) => {
			if (
				chunk.length >= 4 &&
				new DataView(chunk.buffer, chunk.byteOffset).getUint32(0, true) ===
					LOCAL_HEADER
			) {
				recording.localHeaders.push(recording.size);
			}
			recording.size += chunk.length;
			if (chunk.length >= tailBytes) {
				recording.tail = chunk.slice(-tailBytes);
			} else {
				const joined = new Uint8Array(recording.tail.length + chunk.length);
				joined.set(recording.tail);
				joined.set(chunk, recording.tail.length);
				recording.tail = joined.slice(-tailBytes);
			}
		},
	});
	return {
		sink,
		recording,
	};
};

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

interface CentralEntry {
	readonly name: string;
	readonly crc: number;
	readonly compressedSize: number;
	readonly size: number;
	readonly localHeaderOffset: number;
}

/** Reads the central directory from the archive's last bytes, via the Zip64 end record. */
const centralDirectory = (tail: Uint8Array, archiveSize: number) => {
	const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
	const at = (offset: number) => offset - (archiveSize - tail.length);
	let locator = tail.length - 22 - 20;
	while (locator >= 0 && view.getUint32(locator, true) !== ZIP64_LOCATOR) {
		locator--;
	}
	expect(locator).toBeGreaterThanOrEqual(0);
	const end = at(Number(view.getBigUint64(locator + 8, true)));
	expect(view.getUint32(end, true)).toBe(ZIP64_END);
	const count = Number(view.getBigUint64(end + 32, true));
	let record = at(Number(view.getBigUint64(end + 48, true)));

	const entries: CentralEntry[] = [];
	for (let index = 0; index < count; index++) {
		expect(view.getUint32(record, true)).toBe(CENTRAL_HEADER);
		const nameLength = view.getUint16(record + 28, true);
		const extraLength = view.getUint16(record + 30, true);
		const commentLength = view.getUint16(record + 32, true);
		const fields = [
			view.getUint32(record + 24, true),
			view.getUint32(record + 20, true),
			view.getUint32(record + 42, true),
		];
		const extraStart = record + 46 + nameLength;
		for (let extra = extraStart; extra < extraStart + extraLength; ) {
			const id = view.getUint16(extra, true);
			const length = view.getUint16(extra + 2, true);
			if (id === 0x0001) {
				let field = extra + 4;
				for (const [position, value] of fields.entries()) {
					if (value === MAX_32) {
						fields[position] = Number(view.getBigUint64(field, true));
						field += 8;
					}
				}
			}
			extra += 4 + length;
		}
		const [size = 0, compressedSize = 0, localHeaderOffset = 0] = fields;
		entries.push({
			name: new TextDecoder().decode(
				tail.subarray(record + 46, record + 46 + nameLength),
			),
			crc: view.getUint32(record + 16, true),
			compressedSize,
			size,
			localHeaderOffset,
		});
		record = extraStart + extraLength + commentLength;
	}
	return entries;
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

	test(
		"writes an entry over 4 GB with Zip64 without holding it",
		async () => {
			const { sink, recording } = recordingSink(64 * 1024);
			const chunk = new Uint8Array(1024 * 1024).fill(7);
			const chunkCount = 4 * 1024 + 1;
			const bigSize = chunk.length * chunkCount;
			let crc = 0;
			for (let index = 0; index < chunkCount; index++) {
				crc = hash.crc32(chunk, crc);
			}

			const size = await Effect.runPromise(
				writeZip(sink, (writer) =>
					Effect.gen(function* () {
						yield* writer.addText("before.txt", "before");
						yield* writer.addFile("big.bin", repeated(chunk, chunkCount));
						yield* writer.addText("after.txt", "after");
					}),
				),
			);

			expect(size).toBe(recording.size);
			expect(size).toBeGreaterThan(bigSize);
			const entries = centralDirectory(recording.tail, size);
			expect(entries.map((entry) => entry.name)).toEqual([
				"before.txt",
				"big.bin",
				"after.txt",
			]);
			const [, big, after] = entries;
			expect(big).toMatchObject({
				size: bigSize,
				compressedSize: bigSize,
				crc,
			});
			expect(after?.localHeaderOffset).toBeGreaterThan(MAX_32);
			expect(recording.localHeaders).toEqual(
				entries.map((entry) => entry.localHeaderOffset),
			);
			expect(process.memoryUsage().rss).toBeLessThan(1024 * 1024 * 1024);
		},
		{
			timeout: 120_000,
		},
	);
});
