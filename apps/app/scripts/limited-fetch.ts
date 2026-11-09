/** Statuses a provider sends while it is limited or the model is briefly unavailable. */
const RETRYABLE = new Set([
	429,
	502,
	503,
	504,
]);
const MAX_RETRIES = 4;
const BACKOFF_MS = 2_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Spaces request starts evenly, so no more than `perMinute` start in any minute and none in a burst. */
const rateLimiter = (perMinute: number) => {
	const gap = 60_000 / perMinute;
	let next = 0;
	return async () => {
		const now = Date.now();
		const start = Math.max(now, next);
		next = start + gap;
		await sleep(start - now);
	};
};

/**
 * Wraps `fetch` to wait for the endpoint's rate limit and to retry limited or
 * unavailable responses with backoff, so a run counts a request as failed only
 * after it was tried several times.
 */
export const limitedFetch = (perMinute?: number): typeof globalThis.fetch => {
	const turn = perMinute ? rateLimiter(perMinute) : undefined;
	return (async (input: RequestInfo | URL, init?: RequestInit) => {
		for (let attempt = 0; ; attempt++) {
			await turn?.();
			const response = await fetch(input, init);
			if (!RETRYABLE.has(response.status) || attempt === MAX_RETRIES) {
				return response;
			}
			const after = Number(response.headers.get("retry-after"));
			await sleep(
				Number.isFinite(after) && after > 0
					? after * 1_000
					: BACKOFF_MS * 2 ** attempt,
			);
		}
	}) as typeof globalThis.fetch;
};
