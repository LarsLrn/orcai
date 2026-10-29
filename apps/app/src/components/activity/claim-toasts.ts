const STORAGE_KEY = "orcai.activity.toasted";
const REMEMBERED = 200;

/** This tab's claims, which still hold when storage cannot be read or written. */
let claimedHere: string[] = [];

const remember = (ids: readonly string[]) => ids.slice(-REMEMBERED);

const toasted = (): string[] => {
	try {
		const stored: unknown = JSON.parse(
			localStorage.getItem(STORAGE_KEY) ?? "[]",
		);
		return Array.isArray(stored) ? stored.map(String) : [];
	} catch {
		return [];
	}
};

const claimHere = (runIds: readonly string[]) => {
	const fresh = runIds.filter((id) => !claimedHere.includes(id));
	claimedHere = remember([
		...claimedHere,
		...fresh,
	]);
	return fresh;
};

const claimShared = (runIds: readonly string[]) => {
	const seen = toasted();
	const fresh = claimHere(runIds.filter((id) => !seen.includes(id)));
	if (fresh.length > 0) {
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify(
					remember([
						...seen,
						...fresh,
					]),
				),
			);
		} catch {
			// Other tabs may toast these runs too.
		}
	}
	return fresh;
};

/**
 * The runs no tab has shown a toast for yet, now marked as shown; tabs claim
 * one at a time under a Web Lock. Without Web Locks each tab claims on its
 * own, so two tabs may both toast a run.
 */
export const claimToasts = async (
	runIds: readonly string[],
): Promise<string[]> => {
	if (typeof navigator === "undefined" || !navigator.locks) {
		return claimHere(runIds);
	}
	try {
		return await navigator.locks.request(STORAGE_KEY, () =>
			claimShared(runIds),
		);
	} catch {
		return claimHere(runIds);
	}
};
