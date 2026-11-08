import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import {
	type FileUploadInfo,
	type UploadStatus,
	uploadFiles,
} from "../src/client";
import type { SignedUrlsSuccessResponse } from "../src/client/internal";

type PartRequest = {
	partNumber: number;
	body: Blob;
};

type PartReply = {
	status: number;
	etag?: string;
};

const accepted = (partNumber: number): PartReply => ({
	status: 200,
	etag: `etag-${partNumber}`,
});

/** What object storage answers to each part PUT; set per test. */
let storage: (request: PartRequest) => Promise<PartReply>;
let requests: PartRequest[];
let arrivalWaiters: {
	count: number;
	arrived: () => void;
}[];
let inFlight: number;

const PART_URL = "https://storage.test/part/";

/** The slice of XMLHttpRequest the client drives, answering from `storage`. */
class StorageXhr {
	readyState = 0;
	status = 0;
	statusText = "";
	responseText = "";
	upload: {
		onprogress:
			| ((event: {
					lengthComputable: boolean;
					loaded: number;
					total: number;
			  }) => void)
			| null;
	} = {
		onprogress: null,
	};
	onloadend: (() => void) | null = null;
	#url = "";
	#etag: string | null = null;
	#settled = false;

	open(_method: string, url: string) {
		this.#url = url;
		this.readyState = 1;
	}

	setRequestHeader() {
		// Storage here checks nothing a header carries.
	}

	getResponseHeader(name: string) {
		return name.toLowerCase() === "etag" ? this.#etag : null;
	}

	send(body: Blob) {
		const request = {
			partNumber: Number(this.#url.slice(PART_URL.length)),
			body,
		};
		requests.push(request);
		inFlight++;
		for (const waiter of arrivalWaiters)
			if (requests.length >= waiter.count) waiter.arrived();
		void storage(request).then((reply) => {
			if (this.#settled) return;
			this.upload.onprogress?.({
				lengthComputable: true,
				loaded: body.size,
				total: body.size,
			});
			this.#settle(reply.status, reply.etag ?? null);
		});
	}

	abort() {
		if (this.#settled) return;
		this.#settle(0, null);
	}

	#settle(status: number, etag: string | null) {
		this.#settled = true;
		inFlight--;
		this.readyState = 4;
		this.status = status;
		this.#etag = etag;
		this.onloadend?.();
	}
}

const original = Object.getOwnPropertyDescriptor(globalThis, "XMLHttpRequest");
beforeAll(() => {
	Object.defineProperty(globalThis, "XMLHttpRequest", {
		value: StorageXhr,
		configurable: true,
		writable: true,
	});
});
afterAll(() => {
	if (original) Object.defineProperty(globalThis, "XMLHttpRequest", original);
	else Reflect.deleteProperty(globalThis, "XMLHttpRequest");
});

beforeEach(() => {
	storage = ({ partNumber }) => Promise.resolve(accepted(partNumber));
	requests = [];
	arrivalWaiters = [];
	inFlight = 0;
});

/** Rejects when `promise` has not settled within two seconds. */
const within = <A>(promise: Promise<A>, what: string) => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return Promise.race([
		promise,
		new Promise<never>((_, reject) => {
			timer = setTimeout(
				() => reject(new Error(`Timed out waiting for ${what}`)),
				2_000,
			);
		}),
	]).finally(() => clearTimeout(timer));
};

/** Settles once storage has received `count` part requests. */
const partsArrived = (count: number) => {
	const { promise, resolve } = Promise.withResolvers<void>();
	if (requests.length >= count) resolve();
	else
		arrivalWaiters.push({
			count,
			arrived: resolve,
		});
	return within(promise, `${count} part requests`);
};

/** Holds every part reply until the test releases it. */
const holdReplies = () => {
	const held = new Map<number, (reply: PartReply) => void>();
	storage = ({ partNumber }) => {
		const { promise, resolve } = Promise.withResolvers<PartReply>();
		held.set(partNumber, resolve);
		return promise;
	};
	const release = (partNumber: number, reply = accepted(partNumber)) => {
		held.get(partNumber)?.(reply);
		held.delete(partNumber);
	};
	return {
		release,
		/** Refuses whatever is still held, so a failed test does not leave the upload hanging. */
		refuseRest: () => {
			for (const partNumber of held.keys())
				release(partNumber, {
					status: 500,
				});
		},
	};
};

const UPLOAD_ID = "upload-1";
const PART_SIZE = 4;
const BYTES = new TextEncoder().encode("0123456789");

const multipartTarget = (file: File): SignedUrlsSuccessResponse => {
	const count = Math.ceil(file.size / PART_SIZE);
	return {
		metadata: {},
		files: [
			{
				mode: "multipart",
				uploadId: UPLOAD_ID,
				partSize: PART_SIZE,
				parts: Array.from(
					{
						length: count,
					},
					(_, index) => ({
						signedUrl: `${PART_URL}${index + 1}`,
						partNumber: index + 1,
						size: Math.min(PART_SIZE, file.size - index * PART_SIZE),
					}),
				),
				file: {
					objectKey: "staging/key-1.bin",
					objectMetadata: {},
					name: file.name,
					size: file.size,
					type: file.type,
				},
			},
		],
	};
};

type CompletedPart = {
	etag: string;
	partNumber: number;
};

/** Starts uploading one ten-byte file in three parts and records what the caller sees. */
const startLargeUpload = (
	options: {
		completion?: () => Promise<unknown>;
		abortion?: () => Promise<unknown>;
		signal?: AbortSignal;
		multipartBatchSize?: number;
	} = {},
) => {
	const file = new File(
		[
			BYTES,
		],
		"large.bin",
		{
			type: "application/octet-stream",
		},
	);
	const completions: CompletedPart[][] = [];
	const abortions: string[] = [];
	const states: FileUploadInfo<UploadStatus>[] = [];
	const done = uploadFiles({
		route: "asset",
		signedUrls: multipartTarget(file),
		files: [
			file,
		],
		signal: options.signal,
		multipartBatchSize: options.multipartBatchSize,
		onFileStateChange: ({ file }) => {
			states.push(file);
		},
		onMultipartComplete: ({ parts }) => {
			completions.push(parts);
			return options.completion?.() ?? Promise.resolve();
		},
		onMultipartAbort: ({ uploadId }) => {
			abortions.push(uploadId);
			return options.abortion?.() ?? Promise.resolve();
		},
	});
	return {
		done,
		completions,
		abortions,
		states,
	};
};

const uploadLargeFile = async (
	options?: Parameters<typeof startLargeUpload>[0],
) => {
	const upload = startLargeUpload(options);
	return {
		...upload,
		result: await within(upload.done, "the upload"),
	};
};

test("completes with every part's quoted ETag in part order and the file's bytes split by part", async () => {
	const replies = holdReplies();
	const upload = startLargeUpload();
	try {
		await partsArrived(3);
		for (const partNumber of [
			3,
			1,
			2,
		])
			replies.release(partNumber);
	} finally {
		replies.refuseRest();
	}
	const result = await within(upload.done, "the upload");

	expect(upload.completions).toEqual([
		[
			{
				etag: '"etag-1"',
				partNumber: 1,
			},
			{
				etag: '"etag-2"',
				partNumber: 2,
			},
			{
				etag: '"etag-3"',
				partNumber: 3,
			},
		],
	]);
	const bodies = await Promise.all(
		[
			...requests,
		]
			.sort((left, right) => left.partNumber - right.partNumber)
			.map(async (request) =>
				new TextDecoder().decode(await request.body.bytes()),
			),
	);
	expect(bodies).toEqual([
		"0123",
		"4567",
		"89",
	]);
	expect(upload.abortions).toEqual([]);
	expect(result.failedFiles).toEqual([]);
	expect(result.files).toMatchObject([
		{
			status: "complete",
			progress: 1,
		},
	]);
});

test("reports the file complete only once storage confirms the completion", async () => {
	const requested = Promise.withResolvers<void>();
	const confirmed = Promise.withResolvers<void>();
	const upload = startLargeUpload({
		completion: () => {
			requested.resolve();
			return confirmed.promise;
		},
	});
	let settled = false;
	void upload.done.finally(() => {
		settled = true;
	});
	try {
		await within(requested.promise, "the completion request");
	} finally {
		confirmed.resolve();
	}
	const whilePending = [
		...upload.states,
	];
	const settledWhilePending = settled;
	const result = await within(upload.done, "the upload");

	expect(settledWhilePending).toBe(false);
	expect(whilePending.map((state) => state.status)).not.toContain("complete");
	const progress = whilePending.map((state) => state.progress);
	expect(progress.every((value) => value < 1)).toBe(true);
	expect(progress).toEqual(
		[
			...progress,
		].sort((left, right) => left - right),
	);
	expect(progress.at(-1)).toBeGreaterThan(0);
	expect(upload.states.slice(whilePending.length)).toMatchObject([
		{
			status: "complete",
			progress: 1,
		},
	]);
	expect(result.files).toHaveLength(1);
});

for (const [failure, reply] of [
	[
		"a refused part",
		{
			status: 500,
		},
	],
	[
		"a part answered without an ETag",
		{
			status: 200,
		},
	],
] as const) {
	test(`${failure} aborts the upload and fails the file`, async () => {
		storage = ({ partNumber }) =>
			Promise.resolve(partNumber === 2 ? reply : accepted(partNumber));
		const { result, completions, abortions } = await uploadLargeFile();

		expect(completions).toEqual([]);
		expect(abortions).toEqual([
			UPLOAD_ID,
		]);
		expect(result.files).toEqual([]);
		expect(result.failedFiles).toMatchObject([
			{
				status: "failed",
				error: {
					type: "s3_upload",
				},
			},
		]);
	});
}

test("a refused completion aborts the upload and fails the file", async () => {
	const { result, abortions } = await uploadLargeFile({
		completion: () => Promise.reject(new Error("InvalidPart")),
	});

	expect(abortions).toEqual([
		UPLOAD_ID,
	]);
	expect(result.files).toEqual([]);
	expect(result.failedFiles).toMatchObject([
		{
			status: "failed",
		},
	]);
});

test("cancelling stops every part in flight and aborts the upload", async () => {
	const controller = new AbortController();
	const replies = holdReplies();
	const upload = startLargeUpload({
		signal: controller.signal,
	});
	let inFlightBeforeCancel = 0;
	try {
		await partsArrived(3);
		inFlightBeforeCancel = inFlight;
	} finally {
		controller.abort();
	}
	const result = await within(upload.done, "the upload");
	replies.refuseRest();

	expect(inFlightBeforeCancel).toBe(3);
	expect(inFlight).toBe(0);
	expect(upload.completions).toEqual([]);
	expect(upload.abortions).toEqual([
		UPLOAD_ID,
	]);
	expect(result.failedFiles).toMatchObject([
		{
			status: "failed",
		},
	]);
});

test("an abort that fails still leaves the file failed", async () => {
	storage = () =>
		Promise.resolve({
			status: 500,
		});
	const { result, abortions } = await uploadLargeFile({
		abortion: () => Promise.reject(new Error("storage unreachable")),
	});

	expect(abortions).toEqual([
		UPLOAD_ID,
	]);
	expect(result.failedFiles).toMatchObject([
		{
			status: "failed",
		},
	]);
});

test("sends at most the batch size of parts at once", async () => {
	const replies = holdReplies();
	const upload = startLargeUpload({
		multipartBatchSize: 2,
	});
	let firstBatch = 0;
	try {
		await partsArrived(2);
		// The client starts a batch's parts together, so a third would be here.
		firstBatch = requests.length;
		replies.release(1);
		replies.release(2);
		await partsArrived(3);
		replies.release(3);
	} finally {
		replies.refuseRest();
	}
	await within(upload.done, "the upload");

	expect(firstBatch).toBe(2);
	expect(upload.completions[0]).toHaveLength(3);
});
