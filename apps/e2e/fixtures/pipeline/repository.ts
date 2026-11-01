import type { BlockId } from "@orcai/core";
import type { RepositoryReadiness } from "@orcai/schema";
import { expect } from "@playwright/test";
import { uploadAsset } from "../assets";
import type { ApiClient } from "../index";
import { runId } from "../organisation";

/** A name no other test uses, so a spec finds its own records. */
export const pipelineName = (label: string): string =>
	`E2E Pipeline ${label} ${runId()}`;

/**
 * A repository of the client's own holding one asset with `content`,
 * uploaded as `type`. The workers prepare it after the upload.
 */
export const repositoryWithAsset = async (
	client: ApiClient,
	{
		label,
		content,
		type = "text/markdown",
	}: {
		label: string;
		content: string;
		type?: "text/markdown" | "text/plain";
	},
) => {
	const asset = await uploadAsset(client, pipelineName(label), {
		content,
		type,
	});
	const block = await client.block.create({
		type: "database",
		name: pipelineName(`${label} Repository`),
		status: "ready",
		assets: [
			asset.id,
		],
		config: {
			minReferences: 1,
			maxReferences: 5,
			defaultReferences: 3,
			scoreThreshold: 0,
		},
	});

	return {
		asset,
		blockId: block.data.id as BlockId,
		name: block.data.name,
	};
};

/** Waits until no asset of the repository is still being prepared. */
export const preparedReadiness = async (
	client: ApiClient,
	blockId: BlockId,
): Promise<RepositoryReadiness> => {
	let readiness: RepositoryReadiness | undefined;
	await expect
		.poll(
			async () => {
				const { data } = await client.block.readiness({
					blockIds: [
						blockId,
					],
				});
				readiness = data[0];
				return readiness?.totals.preparing;
			},
			{
				timeout: 20_000,
			},
		)
		.toBe(0);
	if (!readiness) throw new Error(`No readiness for repository ${blockId}`);
	return readiness;
};
