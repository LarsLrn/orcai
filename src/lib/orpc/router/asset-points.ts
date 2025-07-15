import { generateEmbedding } from "@/lib/ai/embedding";
import { authed } from "@/lib/orpc";
import { requireActiveCourseMiddleware } from "@/lib/orpc/middlewares/auth";
import { retry } from "@/lib/orpc/middlewares/retry";
import { qdrant } from "@/qdrant/qdrant";
import { qdrantCollections } from "@/qdrant/qdrant-constants";

export const listAssetPoints = authed.assetPoints.list
	.use(requireActiveCourseMiddleware)
	.use(retry({ times: 3 }))
	.handler(async ({ input, context }) => {
		/* const { entityIds } = await listAllowedEntities({
			userId: context.session.user.id,
			action: "read",
			entityType: "asset",
		}); */

		const { points } = await qdrant.query(qdrantCollections.chunks.name, {
			query: input.filters.search
				? await generateEmbedding(input.filters.search)
				: undefined,
			filter: {
				must: [
					{
						key: qdrantCollections.chunks.index.courseId,
						match: {
							value: context.activeCourseId,
						},
					},
					input.filters.documentId && {
						key: "document_id", // TODO: get type properly
						match: {
							value: input.filters.documentId,
						},
					},
				],
			},
			limit: input.filters.limit ?? undefined,
			with_payload: true,
			with_vector: false,
			score_threshold: input.filters.search ? 0.5 : undefined,
		});

		return { data: points };
	});
