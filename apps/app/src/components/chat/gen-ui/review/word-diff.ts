export type DiffToken = {
	text: string;
	kind: "same" | "add" | "del";
};

/** A longest-common-subsequence diff over words, whitespace kept as tokens. */
export const wordDiff = (before: string, after: string): DiffToken[] => {
	const a = before.split(/(\s+)/);
	const b = after.split(/(\s+)/);
	const table = Array.from(
		{
			length: a.length + 1,
		},
		() => new Array<number>(b.length + 1).fill(0),
	);
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			table[i][j] =
				a[i] === b[j]
					? table[i + 1][j + 1] + 1
					: Math.max(table[i + 1][j], table[i][j + 1]);
		}
	}
	const tokens: DiffToken[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			tokens.push({
				text: a[i],
				kind: "same",
			});
			i++;
			j++;
		} else if (table[i + 1][j] >= table[i][j + 1]) {
			tokens.push({
				text: a[i++],
				kind: "del",
			});
		} else {
			tokens.push({
				text: b[j++],
				kind: "add",
			});
		}
	}
	while (i < a.length) {
		tokens.push({
			text: a[i++],
			kind: "del",
		});
	}
	while (j < b.length) {
		tokens.push({
			text: b[j++],
			kind: "add",
		});
	}
	return tokens.filter((token) => token.text !== "");
};

/** Share of the original's words that survive into the revision. */
export const retainedShare = (tokens: readonly DiffToken[]): number => {
	const original = tokens.filter(
		(token) => token.kind !== "add" && token.text.trim() !== "",
	);
	const kept = original.filter((token) => token.kind === "same").length;
	return kept / Math.max(original.length, 1);
};
