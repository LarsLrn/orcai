import { afterEach, describe, expect, test } from "bun:test";
import {
	installViewTransitionReadyHandler,
	pageViewTransitionTypes,
} from "./view-transitions";

describe("pageViewTransitionTypes", () => {
	afterEach(() => {
		Reflect.deleteProperty(document, "visibilityState");
	});

	test("cross-fades between pages", () => {
		expect(
			pageViewTransitionTypes({
				pathChanged: true,
			}),
		).toEqual([]);
	});

	test("starts no transition when only the search changes", () => {
		expect(
			pageViewTransitionTypes({
				pathChanged: false,
			}),
		).toBe(false);
	});

	test("starts no transition while the document is hidden", () => {
		Object.defineProperty(document, "visibilityState", {
			value: "hidden",
			configurable: true,
		});

		expect(
			pageViewTransitionTypes({
				pathChanged: true,
			}),
		).toBe(false);
	});
});

describe("installViewTransitionReadyHandler", () => {
	const reportedAfter = async (readyError: unknown) => {
		const reported: unknown[] = [];
		const reportError = globalThis.reportError;
		globalThis.reportError = (error) => {
			reported.push(error);
		};
		Object.defineProperty(document, "startViewTransition", {
			value: () => ({
				ready: Promise.reject(readyError),
				updateCallbackDone: Promise.resolve(),
				finished: Promise.resolve(),
			}),
			configurable: true,
			writable: true,
		});

		installViewTransitionReadyHandler();
		document.startViewTransition(() => undefined);
		await Promise.resolve();
		await Promise.resolve();

		globalThis.reportError = reportError;
		Reflect.deleteProperty(document, "startViewTransition");
		Reflect.deleteProperty(document, "visibilityState");

		return reported;
	};

	test("handles a transition skipped by a newer one", async () => {
		expect(
			await reportedAfter(
				new DOMException(
					"Transition was skipped. New ViewTransition started",
					"AbortError",
				),
			),
		).toEqual([]);
	});

	test("handles a transition the hidden document does not run", async () => {
		Object.defineProperty(document, "visibilityState", {
			value: "hidden",
			configurable: true,
		});

		expect(
			await reportedAfter(
				new DOMException("The document is hidden", "InvalidStateError"),
			),
		).toEqual([]);
	});

	test("reports an invalid state on a visible document", async () => {
		const failure = new DOMException(
			"Duplicate view-transition-name value",
			"InvalidStateError",
		);

		expect(await reportedAfter(failure)).toEqual([
			failure,
		]);
	});

	test("reports any other failure", async () => {
		const failure = new Error("update failed");

		expect(await reportedAfter(failure)).toEqual([
			failure,
		]);
	});
});
