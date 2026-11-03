import type { AssetId, BlockId } from "@orcai/core";
import { advisoryXactLock, DB, dbSchema } from "@orcai/db";
import {
	deleteAttemptPoints,
	publishAttemptPoints,
	writeGeneration,
} from "@orcai/qdrant";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";

type Link = {
	readonly assetId: AssetId;
	readonly blockId: BlockId;
};

/**
 * Runs `body` on the active embedding generation's collection, in a
 * transaction holding the link's points lock, so writes to its Qdrant points
 * never interleave and never outlive their generation.
 */
export const withLinkPoints = <A, E, R>(
	link: Link,
	body: Effect.Effect<A, E, R>,
) =>
	writeGeneration(
		Effect.gen(function* () {
			const db = yield* DB;
			yield* db.execute(
				advisoryXactLock("linkPoints", `${link.assetId}/${link.blockId}`),
			);
			return yield* body;
		}),
	);

/**
 * Serves the `indexed` attempt's points and no other attempt's; `null` serves
 * none. Runs under the link's points lock.
 */
export const serveIndexedAttempt = (
	{ assetId, blockId }: Link,
	indexed: number | null,
) =>
	Effect.gen(function* () {
		const link = {
			assetId,
			blockId,
		};
		if (indexed !== null) {
			yield* publishAttemptPoints({
				...link,
				attempts: {
					from: indexed,
					to: indexed + 1,
				},
				published: true,
			});
			yield* publishAttemptPoints({
				...link,
				attempts: {
					to: indexed,
				},
				published: false,
			});
		}
		// An attempt published by a completion that did not commit.
		yield* publishAttemptPoints({
			...link,
			attempts: {
				from: indexed === null ? undefined : indexed + 1,
			},
			published: false,
		});
	});

/**
 * Converges a repository link's points on its committed state: serves the
 * indexed attempt's, deletes earlier ones, and deletes those of attempts
 * replaced since and of a failed current one. The current unfinished
 * attempt's stay. Without a link, every point goes. Each step is idempotent,
 * so the next run resumes a failed one. Before embeddings are set up there
 * are no points.
 */
export const reconcileLinkPoints = (link: Link) =>
	withLinkPoints(
		link,
		Effect.gen(function* () {
			const db = yield* DB;
			const { blockAsset } = dbSchema;
			const points = {
				assetId: link.assetId,
				blockId: link.blockId,
			};
			const [state] = yield* db
				.select({
					attempt: blockAsset.indexAttempt,
					status: blockAsset.indexStatus,
					indexed: blockAsset.indexedAttempt,
				})
				.from(blockAsset)
				.where(
					and(
						eq(blockAsset.assetId, link.assetId),
						eq(blockAsset.blockId, link.blockId),
					),
				);
			if (!state) {
				return yield* deleteAttemptPoints({
					...points,
					attempts: {},
				});
			}

			const { indexed } = state;
			yield* serveIndexedAttempt(points, indexed);
			if (indexed !== null) {
				yield* deleteAttemptPoints({
					...points,
					attempts: {
						to: indexed,
					},
				});
			}
			yield* deleteAttemptPoints({
				...points,
				attempts: {
					from: indexed === null ? undefined : indexed + 1,
					to: state.status === "failed" ? state.attempt + 1 : state.attempt,
				},
			});
		}),
	).pipe(Effect.catchTag("EmbeddingsNotConfiguredError", () => Effect.void));
