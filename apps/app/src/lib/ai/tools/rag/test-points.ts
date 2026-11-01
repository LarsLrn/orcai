import type { RetrievedAssetPoint } from "@orcai/schema";
import type { PointWithBlock } from "./types";

interface PointFields {
	id: string;
	index: number;
	assetId?: string;
	title?: string;
	text?: string;
	pageStart?: number;
	pageEnd?: number;
}

/** A text point of the "Handbook" block, as search procedures return it. */
export const assetPoint = ({
	id,
	index,
	assetId = "asset-a",
	title = "Refund policy",
	text = `Text of chunk ${index}.`,
	pageStart,
	pageEnd = pageStart,
}: PointFields): RetrievedAssetPoint =>
	({
		id,
		version: 1,
		score: 0.5,
		title,
		payload: {
			source: "text",
			asset_id: assetId,
			block_id: "block-1",
			text,
			documentTotalPages: 20,
			chunkPageStart: pageStart,
			chunkPageEnd: pageEnd,
			depth: 0,
			tokens: 10,
			chunk_index: index,
			chunkCount: 20,
			createdAt: "2026-10-01T00:00:00.000Z",
		},
	}) as RetrievedAssetPoint;

export const point = (fields: PointFields): PointWithBlock => ({
	...assetPoint(fields),
	sourceBlock: {
		id: "block-1",
		name: "Handbook",
	} as PointWithBlock["sourceBlock"],
});
