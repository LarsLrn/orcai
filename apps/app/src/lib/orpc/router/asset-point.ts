import { browseAssetPoints, buildQdrantFilter } from "@orcai/qdrant";
import * as Effect from "effect/Effect";
import {
	linkedPoints,
	onSearchGeneration,
	repositoryAssetScope,
	searchRepositories,
} from "@/lib/blocks/repository-search";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	requireEntitiesAccess,
	requireEntityAccess,
} from "@/lib/orpc/middlewares/permission";

const searchRepositoryAssetPoint = authed.assetPoint.searchRepository
	.use(
		requireEntityAccess("block", "read", {
			entityId: "repositoryId",
		}),
	)
	.effect(function* ({ input }) {
		const [answer] = yield* searchRepositories([
			input,
		]);
		return answer;
	});

const searchRepositoriesAssetPoint = authed.assetPoint.searchRepositories
	.use(
		requireEntitiesAccess("block", "read", ({ searches }) =>
			searches.map(({ repositoryId }) => repositoryId),
		),
	)
	.effect(function* ({ input }) {
		return {
			results: yield* searchRepositories(input.searches),
		};
	});

const BROWSE_PAGE_SIZE = 50;

const browseRepositoryAssetPoint = authed.assetPoint.browseRepository
	.use(
		requireEntityAccess("block", "read", {
			entityId: "repositoryId",
		}),
	)
	.effect(function* ({ input }) {
		const assetIds = yield* repositoryAssetScope(
			input.repositoryId,
			input.assetId
				? [
						input.assetId,
					]
				: undefined,
		);

		if (assetIds.length === 0) {
			return {
				data: [],
				nextCursor: null,
			};
		}

		return yield* onSearchGeneration(
			browseAssetPoints({
				filter: buildQdrantFilter({
					blockId: input.repositoryId,
					assetIds,
				}),
				order: input.assetId ? "reading" : "point",
				cursor: input.cursor,
				limit: BROWSE_PAGE_SIZE,
			}),
		).pipe(
			Effect.flatMap((page) =>
				linkedPoints(page.data).pipe(
					Effect.map((data) => ({
						...page,
						data,
					})),
				),
			),
		);
	});

export const assetPointRouter = {
	searchRepository: searchRepositoryAssetPoint,
	searchRepositories: searchRepositoriesAssetPoint,
	browseRepository: browseRepositoryAssetPoint,
};
