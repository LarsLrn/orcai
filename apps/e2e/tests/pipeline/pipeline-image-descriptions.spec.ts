import type { AssetId, BlockId } from "@orcai/core";
import { uploadAsset } from "../../fixtures/assets";
import { setUpChatModel } from "../../fixtures/chat/chat";
import type { ApiClient } from "../../fixtures/index";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import {
	pipelineName,
	preparedReadiness,
} from "../../fixtures/pipeline/repository";
import { useUtilityModel } from "../../fixtures/pipeline/utility-model";

// Specs here set the worker organisation's utility model; later specs expect none.
test.afterEach(async ({ api, org }) => {
	await api.as("admin").organization.update({
		id: org.id,
		utilityModelId: null,
	});
});

// A 1x1 transparent PNG.
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
	"base64",
);

const DESCRIPTION = {
	text: "A bar chart of refunds per month: January 4, February 7.",
	title: "Refunds per month",
	description: "A bar chart of refunds in January and February.",
	language: "en",
};

const uploadImage = (client: ApiClient, label: string) =>
	uploadAsset(client, `${pipelineName(label)}.png`, {
		content: PNG,
		type: "image/png",
	});

const repositoryOf = async (client: ApiClient, assetId: AssetId) => {
	const block = await client.block.create({
		type: "database",
		name: pipelineName("Images Repository"),
		status: "ready",
		assets: [
			assetId,
		],
		config: {
			minReferences: 1,
			maxReferences: 5,
			defaultReferences: 3,
			scoreThreshold: 0,
		},
	});
	return block.data.id as BlockId;
};

test("pipeline: an uploaded image is described once by the utility model, indexed from its description and titled from it", async ({
	api,
	inference,
	org,
}) => {
	const { providerId } = await setUpChatModel(api, inference);
	const visionModel = await useUtilityModel(api, org.id, providerId, [
		"text",
		"image",
	]);
	inference.respondWith({
		model: visionModel,
		text: JSON.stringify(DESCRIPTION),
	});
	const member = api.as("member");
	const asset = await uploadImage(member, "Chart");

	const repositoryId = await repositoryOf(member, asset.id);
	const readiness = await preparedReadiness(member, repositoryId);
	expect(readiness.totals.ready).toBe(1);
	// The metadata job applies the suggestion processing stored, without a call.
	await expect
		.poll(
			async () =>
				(
					await member.asset.find({
						id: asset.id,
					})
				).data.metadataStatus,
		)
		.toBe("completed");

	const visionCalls = inference.requests.filter(
		({ path, body }) =>
			path === "/v1/chat/completions" &&
			(
				body as {
					model?: string;
				}
			).model === visionModel,
	);
	expect(visionCalls).toHaveLength(1);
	expect(JSON.stringify(visionCalls[0]?.body)).toContain("image_url");

	const { data: points } = await member.assetPoint.browseRepository({
		repositoryId,
		assetId: asset.id,
	});
	expect(
		points.map((point) => [
			point.title,
			point.payload.text,
		]),
	).toEqual([
		[
			DESCRIPTION.title,
			DESCRIPTION.text,
		],
	]);
});

test("pipeline: an image fails with the reason when the utility model cannot read images", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const { providerId } = await setUpChatModel(api, inference);
	await useUtilityModel(api, org.id, providerId, [
		"text",
	]);
	const member = api.as("member");
	const asset = await uploadImage(member, "Photo");

	await expect
		.poll(
			async () => {
				const { data } = await member.asset.find({
					id: asset.id,
				});
				return [
					data.processingStatus,
					data.processingFailure,
				];
			},
			{
				timeout: 20_000,
			},
		)
		.toEqual([
			"failed",
			"unsupported",
		]);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/hub/assets/${asset.id}`);
	await expect(
		page.getByText(message("pipeline_failure_unsupported_image")),
	).toBeVisible();
});
