import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { claimToasts } from "./claim-toasts";

const STORAGE_KEY = "orcai.activity.toasted";

/** Run ids no earlier test claimed, since a tab keeps its claims in memory. */
const runIds = (count: number) =>
	Array.from(
		{
			length: count,
		},
		() => crypto.randomUUID(),
	);

/** Web Locks as browsers grant them: one holder per name at a time, in order. Happy DOM has none. */
const fakeLocks = () => {
	let held: Promise<unknown> = Promise.resolve();
	return {
		request: <T>(_name: string, callback: () => T | Promise<T>) => {
			const granted = held.then(callback);
			held = granted.catch(() => undefined);
			return granted;
		},
	};
};

const useLocks = (locks: unknown) =>
	Object.defineProperty(navigator, "locks", {
		value: locks,
		configurable: true,
	});

beforeEach(() => {
	localStorage.clear();
	useLocks(fakeLocks());
});

afterEach(() => {
	Reflect.deleteProperty(navigator, "locks");
});

describe("claimToasts", () => {
	test("a run is claimed once, by whichever tab or mount asks first", async () => {
		const [first, second, third] = runIds(3);
		expect(
			await claimToasts([
				first,
				second,
			]),
		).toEqual([
			first,
			second,
		]);
		expect(
			await claimToasts([
				second,
				third,
			]),
		).toEqual([
			third,
		]);
	});

	test("a run another tab claimed is not claimed again", async () => {
		const [theirs, ours] = runIds(2);
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify([
				theirs,
			]),
		);
		expect(
			await claimToasts([
				theirs,
				ours,
			]),
		).toEqual([
			ours,
		]);
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "")).toEqual([
			theirs,
			ours,
		]);
	});

	test("concurrent claims of the same run hand it out once", async () => {
		const [id] = runIds(1);
		const claims = await Promise.all([
			claimToasts([
				id,
			]),
			claimToasts([
				id,
			]),
		]);
		expect(claims.flat()).toEqual([
			id,
		]);
	});

	test("unreadable storage starts over instead of failing", async () => {
		const [id] = runIds(1);
		localStorage.setItem(STORAGE_KEY, "{not json");
		expect(
			await claimToasts([
				id,
			]),
		).toEqual([
			id,
		]);
	});

	test("storage that cannot be read or written still claims each run once in this tab", async () => {
		const failing = (method: "getItem" | "setItem") => ({
			getItem: (key: string) => original.getItem(key),
			setItem: (key: string, value: string) => original.setItem(key, value),
			[method]: () => {
				throw new DOMException("denied", "SecurityError");
			},
		});
		const original = localStorage;
		const useStorage = (storage: unknown) =>
			Object.defineProperty(globalThis, "localStorage", {
				value: storage,
				configurable: true,
			});
		for (const method of [
			"getItem",
			"setItem",
		] as const) {
			const [id] = runIds(1);
			useStorage(failing(method));
			try {
				expect(
					await claimToasts([
						id,
					]),
				).toEqual([
					id,
				]);
				expect(
					await claimToasts([
						id,
					]),
				).toEqual([]);
			} finally {
				useStorage(original);
			}
		}
	});

	test("without Web Locks a tab claims on its own and leaves storage alone", async () => {
		const [id] = runIds(1);
		useLocks(undefined);
		const claims = await Promise.all([
			claimToasts([
				id,
			]),
			claimToasts([
				id,
			]),
		]);
		expect(claims.flat()).toEqual([
			id,
		]);
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});

	test("a lock that cannot be taken falls back to this tab's claims", async () => {
		const [id] = runIds(1);
		useLocks({
			request: () =>
				Promise.reject(new DOMException("denied", "SecurityError")),
		});
		expect(
			await claimToasts([
				id,
			]),
		).toEqual([
			id,
		]);
		expect(
			await claimToasts([
				id,
			]),
		).toEqual([]);
	});
});
