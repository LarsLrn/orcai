import type { AssetId } from "@orcai/core";
import type { Page } from "@playwright/test";
import { uploadAsset } from "../../fixtures/assets";
import { setUpChatModel } from "../../fixtures/chat/chat";
import type { ApiClient } from "../../fixtures/index";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { pipelineName } from "../../fixtures/pipeline/repository";
import { useUtilityModel } from "../../fixtures/pipeline/utility-model";

// Specs here set the worker organisation's utility model; later specs expect none.
test.afterEach(async ({ api, org }) => {
	await api.as("admin").organization.update({
		id: org.id,
		utilityModelId: null,
	});
});

/** What the utility model answers: every key of the schema, the unknown ones null. */
const metadataReply = (fields: {
	title: string;
	description: string;
	citation: string;
}) =>
	JSON.stringify({
		sourceType: null,
		author: null,
		chapterTitle: null,
		journalName: null,
		volume: null,
		issueNumber: null,
		pageRange: null,
		doi: null,
		websiteName: null,
		externalUrl: null,
		accessDate: null,
		legalReference: null,
		jurisdiction: null,
		language: "en",
		...fields,
	});

const GENERATED = {
	title: "Refund policy",
	description: "When and how refunds are paid.",
	citation: "Finance Office, 2026",
};

const uploadDocument = (client: ApiClient, label: string) =>
	uploadAsset(client, `${pipelineName(label)}.txt`, {
		content: "Refunds are paid within 14 days of the request being approved.",
	});

const generated = async (client: ApiClient, assetId: AssetId) => {
	await expect
		.poll(
			async () =>
				(
					await client.asset.find({
						id: assetId,
					})
				).data.metadataStatus,
			{
				timeout: 30_000,
			},
		)
		.toBe("completed");
	return (
		await client.asset.find({
			id: assetId,
		})
	).data;
};

const card = (page: Page, title: string) =>
	page.locator('[data-slot="tile"]').filter({
		hasText: title,
	});

test("pipeline: a library upload gets its metadata from the utility model", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const { providerId } = await setUpChatModel(api, inference);
	const utilityModel = await useUtilityModel(api, org.id, providerId, [
		"text",
	]);
	inference.respondWith({
		model: utilityModel,
		text: metadataReply(GENERATED),
	});
	const member = api.as("member");
	const asset = await uploadDocument(member, "Refunds");

	const after = await generated(member, asset.id);
	expect(after.title).toBe(GENERATED.title);
	expect(after.metadata).toMatchObject({
		description: GENERATED.description,
		citation: GENERATED.citation,
		language: "en",
	});
	expect(after.metadataSuggestion).toBeNull();

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/app/library/assets");
	await expect(
		card(page, GENERATED.title).getByText(GENERATED.description),
	).toBeVisible();
});

test("pipeline: Generate with AI suggests metadata to review before saving", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const { providerId } = await setUpChatModel(api, inference);
	const utilityModel = await useUtilityModel(api, org.id, providerId, [
		"text",
	]);
	inference.respondWith({
		model: utilityModel,
		text: metadataReply(GENERATED),
	});
	const member = api.as("member");
	const asset = await uploadDocument(member, "Review");
	await generated(member, asset.id);

	const suggested = {
		title: "Refund rules",
		description: "The rules for paying refunds, with deadlines.",
		citation: GENERATED.citation,
	};
	inference.respondWith({
		model: utilityModel,
		text: metadataReply(suggested),
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/assets/${asset.id}/edit`);
	await page
		.getByRole("button", {
			name: message("assets_metadata_generate_button"),
		})
		.click();

	const review = page.getByRole("region", {
		name: message("assets_metadata_review_title"),
	});
	await expect(review).toBeVisible({
		timeout: 30_000,
	});

	// The library lists the asset under "Suggestions to review" while it waits.
	const library = await page.context().newPage();
	const listed = () =>
		library.locator('[data-slot="tile"]').filter({
			hasText: GENERATED.title,
		});
	await open(library, "/app/library/assets?review=true");
	await expect(listed()).toBeVisible();
	await expect(
		library.getByRole("checkbox", {
			name: message("library_filter_review_suggestions"),
		}),
	).toBeChecked();

	const field = (key: string) =>
		review.getByRole("checkbox", {
			name: new RegExp(`^${message(key)}`),
		});
	// Fields with a value start rejected; unchanged fields are not listed.
	await expect(field("assets_metadata_source_title_label")).not.toBeChecked();
	await expect(field("assets_metadata_description_label")).not.toBeChecked();
	await expect(field("assets_metadata_citation_label")).toHaveCount(0);

	await field("assets_metadata_description_label").check();
	await review
		.getByRole("button", {
			name: message("assets_metadata_review_apply_button"),
		})
		.click();
	await expect(review).toBeHidden();
	await page
		.getByRole("button", {
			name: message("assets_form_submit_button"),
		})
		.click();

	await expect
		.poll(async () => {
			const { data } = await member.asset.find({
				id: asset.id,
			});
			return [
				data.title,
				data.metadata.description,
				data.metadataSuggestion,
			];
		})
		.toEqual([
			GENERATED.title,
			suggested.description,
			null,
		]);

	await library.reload();
	await expect(listed()).toHaveCount(0);
});

test("pipeline: saving an editor opened before generation keeps the generated fields", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const member = api.as("member");
	const asset = await uploadDocument(member, "Open editor");
	await expect
		.poll(
			async () =>
				(
					await member.asset.find({
						id: asset.id,
					})
				).data.processingStatus,
			{
				timeout: 30_000,
			},
		)
		.toBe("completed");

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/assets/${asset.id}/edit`);
	const title = page.getByRole("textbox", {
		name: message("assets_metadata_source_title_label"),
	});
	await expect(title).toHaveValue(asset.title);

	const { providerId } = await setUpChatModel(api, inference);
	const utilityModel = await useUtilityModel(api, org.id, providerId, [
		"text",
	]);
	inference.respondWith({
		model: utilityModel,
		text: metadataReply(GENERATED),
	});
	await member.asset.generateMissingMetadata({
		ids: [
			asset.id,
		],
	});
	await generated(member, asset.id);

	await title.fill("Refunds, edited");
	await page
		.getByRole("button", {
			name: message("assets_form_submit_button"),
		})
		.click();

	await expect
		.poll(async () => {
			const { data } = await member.asset.find({
				id: asset.id,
			});
			return [
				data.title,
				data.metadata.description,
				data.metadata.citation,
			];
		})
		.toEqual([
			"Refunds, edited",
			GENERATED.description,
			GENERATED.citation,
		]);
});
