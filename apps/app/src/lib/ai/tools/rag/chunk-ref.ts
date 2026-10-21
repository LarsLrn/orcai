import type { Passage } from "./types";

const REF_SPACE = 36 ** 6;

/** What Qdrant takes for a point id: a UUID or an unsigned integer. */
const POINT_ID =
	/^(?:[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}|\d+)$/i;

/** A chunk's short name for the model: `k` and 6 base36 characters of its point id's FNV-1a hash. */
export const chunkRef = (pointId: string) => {
	let hash = 0x811c9dc5;
	for (let index = 0; index < pointId.length; index += 1) {
		hash ^= pointId.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}

	return `k${((hash >>> 0) % REF_SPACE).toString(36).padStart(6, "0")}`;
};

/** The point ids behind the refs of a conversation's passages, and of those its tools return next. */
export const chunkIds = (passages: Passage[]) => {
	const ids = new Map(
		passages.map(({ ref, id }) => [
			ref,
			id,
		]),
	);

	return {
		add: (more: Passage[]) => {
			for (const { ref, id } of more) {
				ids.set(ref, id);
			}
		},
		/** A ref's point id, or the point id given; undefined for anything else. */
		idOf: (refOrId: string) =>
			ids.get(refOrId) ?? (POINT_ID.test(refOrId) ? refOrId : undefined),
	};
};

export type ChunkIds = ReturnType<typeof chunkIds>;
