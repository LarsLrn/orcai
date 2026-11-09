import type { AssetPointPayload } from "@orcai/schema";
import type { Schemas } from "@qdrant/qdrant-js";

type Condition = Schemas["Condition"];
type Filter = Schemas["Filter"];

/** The payload fields asset points are filtered, indexed and ordered by. */
export const payloadKey = {
	assetId: "asset_id",
	blockId: "block_id",
	chunkIndex: "chunk_index",
	chunkPageStart: "chunkPageStart",
	chunkPageEnd: "chunkPageEnd",
	indexAttempt: "index_attempt",
	published: "published",
	source: "source",
} as const satisfies Record<string, keyof AssetPointPayload>;

type PayloadKey = (typeof payloadKey)[keyof typeof payloadKey];

export const matchValue = (
	key: PayloadKey,
	value: Schemas["ValueVariants"],
): Condition => ({
	key,
	match: {
		value,
	},
});

const matchAny = (
	key: PayloadKey,
	values: readonly string[] | readonly number[],
): Condition => ({
	key,
	match: {
		any: [
			...values,
		] as Schemas["AnyVariants"],
	},
});

export const inRange = (
	key: PayloadKey,
	range: Schemas["Range"],
): Condition => ({
	key,
	range,
});

const asArray = <T>(value: T | T[] | null | undefined) =>
	value == null
		? []
		: Array.isArray(value)
			? value
			: [
					value,
				];

/** `filter` with `conditions` added to what every point must match. */
export const withConditions = (
	filter: Filter | undefined,
	...conditions: Condition[]
): Filter => ({
	...filter,
	must: [
		...asArray(filter?.must),
		...conditions,
	],
});

/** `filter`, leaving out points whose attempt has not completed. */
export const servedFilter = (filter: Filter | undefined) =>
	withConditions(filter, matchValue(payloadKey.published, true));

const unique = <T>(values: readonly T[] | undefined) => [
	...new Set(values),
];

/**
 * The points matching every given restriction: one of `pointIds`, one of
 * `assetIds`, `blockId`, overlapping `page` or `pageFrom`..`pageTo`, one of
 * `chunkIndices`, from `source`. Undefined when nothing is restricted.
 */
export const buildQdrantFilter = (params: {
	pointIds?: readonly string[];
	assetIds?: readonly string[];
	blockId?: string;
	page?: number;
	pageFrom?: number;
	pageTo?: number;
	chunkIndices?: readonly number[];
	source?: AssetPointPayload["source"];
}): Filter | undefined => {
	const pointIds = unique(params.pointIds);
	const assetIds = unique(params.assetIds);
	const chunkIndices = unique(params.chunkIndices);
	const pageTo = params.page ?? params.pageTo;
	const pageFrom = params.page ?? params.pageFrom;
	const must = [
		...(assetIds.length > 0
			? [
					matchAny(payloadKey.assetId, assetIds),
				]
			: []),
		...(pointIds.length > 0
			? [
					{
						has_id: pointIds,
					},
				]
			: []),
		...(params.blockId !== undefined
			? [
					matchValue(payloadKey.blockId, params.blockId),
				]
			: []),
		...(pageTo !== undefined
			? [
					inRange(payloadKey.chunkPageStart, {
						lte: pageTo,
					}),
				]
			: []),
		...(pageFrom !== undefined
			? [
					inRange(payloadKey.chunkPageEnd, {
						gte: pageFrom,
					}),
				]
			: []),
		...(chunkIndices.length > 0
			? [
					matchAny(payloadKey.chunkIndex, chunkIndices),
				]
			: []),
		...(params.source !== undefined
			? [
					matchValue(payloadKey.source, params.source),
				]
			: []),
	];
	return must.length > 0
		? {
				must,
			}
		: undefined;
};
