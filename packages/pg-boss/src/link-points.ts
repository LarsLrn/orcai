import type { AssetId, BlockId } from "@orcai/core";
import { advisoryXactLock, DB, dbSchema } from "@orcai/db";
import { deleteAttemptPoints, publishAttemptPoints } from "@orcai/qdrant";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";

const LINK_POINTS_LOCK_SPACE = 51830477;

type Link = {
	readonly assetId: AssetId;
	readonly blockId: BlockId;
};

/** Runs `body` in a transaction holding the link's points lock, so writes to its Qdrant points never interleave. */
export const withLinkPoints = <A, E, R>(
	link: Link,
	body: Effect.Effect<A, E, R>,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db.transaction(() =>
			Effect.gen(function* () {
				yield* db.execute(
					advisoryXactLock(
						LINK_POINTS_LOCK_SPACE,
						`${link.assetId}/${link.blockId}`,
					),
				);
				return yield* body;
			}),
		);
	});

/**
 * Converges a repository link's points on its committed state: publishes the
 * indexed attempt's, then unpublishes and deletes earlier ones, and deletes
 * those of attempts replaced since and of a failed current one. The current
 * unfinished attempt's stay. Without a link, every point goes. Each step is
 * idempotent, so the next run resumes a failed one.
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
			if (indexed !== null) {
				yield* publishAttemptPoints({
					...points,
					attempts: {
						from: indexed,
						to: indexed + 1,
					},
					published: true,
				});
				yield* publishAttemptPoints({
					...points,
					attempts: {
						to: indexed,
					},
					published: false,
				});
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
	);
