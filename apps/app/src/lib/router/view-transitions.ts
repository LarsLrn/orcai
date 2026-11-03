/** A cross-fade between pages, not when only the search changes (paging, filters, a query) or while the document is hidden. */
export const pageViewTransitionTypes = ({
	pathChanged,
}: {
	pathChanged: boolean;
}): string[] | false =>
	pathChanged && document.visibilityState === "visible" ? [] : false;

/** `ready` also rejects when a transition does not run: skipped by a newer one, a slow update, or a hidden document. */
const isSkippedTransition = (error: unknown) =>
	error instanceof DOMException &&
	(error.name === "AbortError" ||
		error.name === "TimeoutError" ||
		(error.name === "InvalidStateError" &&
			document.visibilityState !== "visible"));

/**
 * The router wraps every navigation in a view transition but only awaits its
 * update, so `ready` rejects unhandled when a quick second navigation skips
 * the first. Skipped transitions are handled here, anything else on `ready`,
 * such as a duplicate `view-transition-name`, is reported as an uncaught error.
 */
export const installViewTransitionReadyHandler = () => {
	if (typeof document.startViewTransition !== "function") return;

	const start = document.startViewTransition.bind(document);

	document.startViewTransition = (...args) => {
		const transition = start(...args);

		transition.ready.catch((error: unknown) => {
			if (!isSkippedTransition(error)) reportError(error);
		});

		return transition;
	};
};
