// Basically just the types used by qdrant, but they aren't exported properly

import type { FileType } from "./file";

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

export type AssetPointPayload = {
	asset_id: string;
	text: string;
	title: string;
	depth: number;
	tokens: number;
	chunkIndex: number;
	chunkCount: number;
	createdAt: string;
} & (
	| {
			source: "image";
			file_reference: string;
			file_type: FileType;
	  }
	| {
			source: "text";
			file_reference?: string;
			file_type?: FileType;
	  }
);
