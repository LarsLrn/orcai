import * as Effect from "effect/Effect";

/**
 * Calls `onSent` once the response body is fully sent, fails, or is cancelled
 * by the client. Only a failed body passes its error.
 */
export const whenSent = (
	response: Response,
	onSent: (failure?: { error: unknown }) => void,
): Response => {
	if (response.body === null) {
		onSent();
		return response;
	}

	const reader = response.body.getReader();
	// A cancel can land while a read is pending; only the first outcome counts.
	let finished = false;
	const finish = (failure?: { error: unknown }) => {
		if (finished) return false;
		finished = true;
		onSent(failure);
		return true;
	};
	const body = new ReadableStream<Uint8Array>({
		async pull(controller) {
			const result = await reader.read().catch((error: unknown) => {
				if (
					finish({
						error,
					})
				) {
					controller.error(error);
				}
			});
			if (!result || finished) return;
			if (result.done) {
				finish();
				controller.close();
			} else {
				controller.enqueue(result.value);
			}
		},
		cancel(reason) {
			finish();
			return reader.cancel(reason);
		},
	});

	return new Response(body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
};

/** The requests a server is still answering, so shutdown can wait for them. */
export const openRequests = () => {
	const open = new Set<Promise<void>>();

	return {
		/** Counts a request as open until its response is sent. */
		track: async (handle: () => Promise<Response>): Promise<Response> => {
			let close: (() => void) | undefined;
			const sent = new Promise<void>((resolve) => {
				close = resolve;
			});
			open.add(sent);
			sent.then(() => open.delete(sent));
			try {
				return whenSent(await handle(), () => close?.());
			} catch (error) {
				close?.();
				throw error;
			}
		},
		/** Completes once no request is open, including ones that arrive meanwhile. */
		drained: Effect.promise(async () => {
			while (open.size > 0) {
				await Promise.all(open);
			}
		}),
	};
};
