import type { AssetPoint, AssetPointBrowseCursor } from "@orcai/schema";
import type { Schemas } from "@qdrant/qdrant-js";
import * as Effect from "effect/Effect";
import { QdrantError } from "./errors";
import { parseAssetPoints, servedFilter } from "./queries";
import { QdrantService } from "./service";

type ReadingCursor = Extract<
	AssetPointBrowseCursor,
	{
		order: "reading";
	}
>;
type Condition = Schemas["Condition"];

const pageOf = (point: AssetPoint) => point.payload.chunkPageStart ?? null;

const byChunk = (a: AssetPoint, b: AssetPoint) =>
	a.payload.chunk_index - b.payload.chunk_index;

/**
 * One page of the served points matching `filter`, `limit` at most.
 *
 * Point order pages with Qdrant's scroll offset. Reading order, meant for one
 * document, goes by page, then chunk, with passages without a page last; images,
 * numbered after a document's text, land at the end of their page. It walks
 * ordered scrolls on the indexed page and chunk numbers, at most four per page
 * of results, whatever the document's size:
 *
 * 1. the rest of the cursor's page, by chunk;
 * 2. the next points by page, whose pages arrive whole but for the last when
 *    the answer is full;
 * 3. that cut page again, by chunk;
 * 4. passages without a page, by chunk.
 */
export const browseAssetPoints = (params: {
	filter: Schemas["Filter"];
	order: AssetPointBrowseCursor["order"];
	cursor?: AssetPointBrowseCursor;
	limit: number;
}) =>
	Effect.gen(function* () {
		const { client, collections } = yield* QdrantService;
		const collection = collections.asset.name;
		const { chunkIndex: CHUNK, chunkPageStart: PAGE } = collections.asset.index;
		const scroll = (request: Schemas["ScrollRequest"]) =>
			Effect.tryPromise({
				try: () =>
					client.scroll(collection, {
						with_payload: true,
						with_vector: false,
						...request,
					}),
				catch: (cause) =>
					new QdrantError({
						operation: "browse",
						cause,
					}),
			});
		const filter = servedFilter(params.filter);
		const base = filter.must;
		const where = (...conditions: Condition[]): Schemas["Filter"] => ({
			...filter,
			must: [
				...(Array.isArray(base)
					? base
					: base
						? [
								base,
							]
						: []),
				...conditions,
			],
		});
		const ordered = (
			key: string,
			conditions: Condition[],
			limit: number,
		): Effect.Effect<AssetPoint[], QdrantError> =>
			limit <= 0
				? Effect.succeed([])
				: scroll({
						filter: where(...conditions),
						limit,
						order_by: {
							key,
						},
					}).pipe(Effect.flatMap((result) => parseAssetPoints(result.points)));

		if (params.order === "point") {
			const from =
				params.cursor?.order === "point" ? params.cursor.from : undefined;
			const result = yield* scroll({
				filter,
				limit: params.limit,
				offset: from,
			});
			const next = result.next_page_offset;

			return {
				data: yield* parseAssetPoints(result.points),
				nextCursor:
					typeof next === "string"
						? ({
								order: "point",
								from: next,
							} as const)
						: null,
			};
		}

		const after: ReadingCursor | undefined =
			params.cursor?.order === "reading" ? params.cursor : undefined;
		// One more than a page tells whether another follows.
		const wanted = params.limit + 1;
		const points: AssetPoint[] = [];

		if (after?.page !== null) {
			if (after) {
				points.push(
					...(yield* ordered(
						CHUNK,
						[
							{
								key: PAGE,
								match: {
									value: after.page,
								},
							},
							{
								key: CHUNK,
								range: {
									gt: after.passageIndex,
								},
							},
						],
						wanted,
					)),
				);
			}

			const requested = wanted - points.length;
			const following = yield* ordered(
				PAGE,
				[
					{
						key: PAGE,
						range: after
							? {
									gt: after.page,
								}
							: {
									gte: 1,
								},
					},
				],
				requested,
			);
			// A short answer holds every remaining page whole; a full one may cut its last.
			const cut =
				following.length > 0 && following.length === requested
					? pageOf(following.at(-1) as AssetPoint)
					: undefined;
			const whole = following
				.filter((point) => cut === undefined || pageOf(point) !== cut)
				.sort((a, b) => (pageOf(a) ?? 0) - (pageOf(b) ?? 0) || byChunk(a, b));
			points.push(...whole);

			if (cut !== undefined && cut !== null) {
				points.push(
					...(yield* ordered(
						CHUNK,
						[
							{
								key: PAGE,
								match: {
									value: cut,
								},
							},
						],
						wanted - points.length,
					)),
				);
			}
		}

		points.push(
			...(yield* ordered(
				CHUNK,
				[
					{
						is_empty: {
							key: PAGE,
						},
					},
					...(after && after.page === null
						? [
								{
									key: CHUNK,
									range: {
										gt: after.passageIndex,
									},
								},
							]
						: []),
				],
				wanted - points.length,
			)),
		);

		const page = points.slice(0, params.limit);
		const last = page.at(-1);

		return {
			data: page,
			nextCursor:
				points.length > params.limit && last
					? ({
							order: "reading",
							page: pageOf(last),
							passageIndex: last.payload.chunk_index,
						} as const)
					: null,
		};
	});
