import type { PointWithBlock } from "./types";

// Passages overlap by up to 200 chars; a shorter shared edge is likely chance.
const MAX_OVERLAP = 400;
const MIN_OVERLAP = 20;

/** `next` appended to `text`, without the start it repeats from `text`'s end. */
export const joinOverlapping = (text: string, next: string) => {
	const head = text.trimEnd();
	const tail = next.trimStart();
	const longest = Math.min(MAX_OVERLAP, head.length, tail.length);

	for (let length = longest; length >= MIN_OVERLAP; length -= 1) {
		if (head.endsWith(tail.slice(0, length))) {
			return head + tail.slice(length);
		}
	}

	return `${head}\n\n${tail}`;
};

const assetKey = (point: PointWithBlock) =>
	`${point.sourceBlock.id}:${point.payload.asset_id}:${point.payload.source}`;

const passageKey = (point: PointWithBlock) =>
	`${assetKey(point)}:${point.payload.chunk_index}`;

/**
 * Groups points into runs of neighbouring points of one asset, each in
 * index order, without repeats. Runs come in the order of their first point.
 */
export const neighbouringRuns = (points: PointWithBlock[]) => {
	const seen = new Set<string>();
	const unique = points.filter((point) => {
		const key = passageKey(point);
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
	const position = new Map(
		unique.map((point, index) => [
			point,
			index,
		]),
	);
	const sorted = [
		...unique,
	].sort(
		(a, b) =>
			assetKey(a).localeCompare(assetKey(b)) ||
			a.payload.chunk_index - b.payload.chunk_index,
	);

	const runs: PointWithBlock[][] = [];
	for (const point of sorted) {
		const run = runs.at(-1);
		const last = run?.at(-1);
		if (
			run &&
			last &&
			assetKey(last) === assetKey(point) &&
			point.payload.chunk_index === last.payload.chunk_index + 1
		) {
			run.push(point);
		} else {
			runs.push([
				point,
			]);
		}
	}

	const firstPosition = (run: PointWithBlock[]) =>
		Math.min(...run.map((point) => position.get(point) ?? 0));

	return runs.sort((a, b) => firstPosition(a) - firstPosition(b));
};
