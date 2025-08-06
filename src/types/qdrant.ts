// Basically just the types used by qdrant, but they aren't exported properly

import type { AssetPointPayload } from "@/lib/orpc/schemas/asset-point";

export interface QdrantPoints {
	points: QdrantPoint[];
}

export interface QdrantPoint {
	id: string | number;
	version: number;
	score: number;
	payload: AssetPointPayload;
	vector?:
		| Record<string, unknown>
		| number[]
		| number[][]
		| {
				[key: string]:
					| number[]
					| number[][]
					| {
							indices: number[];
							values: number[];
					  }
					| undefined;
		  }
		| null
		| undefined;
	shard_key?: string | number | Record<string, unknown> | null | undefined;
	order_value?: number | Record<string, unknown> | null | undefined;
}
