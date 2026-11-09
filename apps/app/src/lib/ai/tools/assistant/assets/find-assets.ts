import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { listPage, listPaging, PAGING_NOTE } from "../list-input";
import { type AssistantToolDeps, callProcedure } from "../procedure-tool";
import { findAssetsInputSchema } from "./find-assets.declaration";

export const findAssetsTool = (deps: AssistantToolDeps) =>
	effectTool({
		description: `Find assets by title among those the user can read, optionally only those in one repository, newest first. Without a query it pages through all of them. Each comes with its preparation state (processingStatus) and where it is kept (keptIn). An asset with keptIn chat is a chat upload, which stays out of repositories until someone adds it to the Library. ${PAGING_NOTE}`,
		inputSchema: findAssetsInputSchema,
		run: ({ query, repositoryId, keptIn, page }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.asset.list(
					{
						...listPage(page),
						filters: {
							search: query,
							repositoryId,
							keptIn,
						},
					},
					options,
				),
			).pipe(
				Effect.map(({ data, rowCount }) => ({
					assets: data.map((asset) => ({
						id: asset.id,
						title: asset.title,
						processingStatus: asset.processingStatus,
						keptIn: asset.keptIn,
						canEdit: asset.capabilities.edit === true,
					})),
					...listPaging(page, rowCount),
				})),
			),
	});
