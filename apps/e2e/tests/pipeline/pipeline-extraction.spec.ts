import type { BrowserContext } from "@playwright/test";
import { uploadAsset } from "../../fixtures/assets";
import { setUpChatModel } from "../../fixtures/chat/chat";
import type { ApiClient } from "../../fixtures/index";
import { expect, test } from "../../fixtures/index";
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

const TITLE = "Annual Report of the Northern Branch";
const BODY =
	"The annual report shows how lending grew in the northern branch library.";
// Kreuzberg reads short lines on a page of their own as a table.
const MORE =
	"Visits to the reading room stayed level, while loans of audiobooks and e-books doubled over the same period.";
const CAPTION = "Figure 1: Loans per year in the northern branch.";
/** Words only the figure shows, large enough for the workers' OCR to read. */
const FIGURE_WORDS = "Quokka Ledger";
const FIGURE_DESCRIPTION = "A sign that reads Quokka Ledger.";

/** A PDF of Chromium's print, with paragraphs, a figure showing `FIGURE_WORDS` and its caption. */
const reportWithFigure = async (context: BrowserContext) => {
	const page = await context.newPage();
	try {
		await page.setViewportSize({
			width: 900,
			height: 300,
		});
		await page.setContent(
			`<body style="margin:0;background:#fff"><p style="font:96px Arial;margin:80px 40px">${FIGURE_WORDS}</p></body>`,
		);
		const figure = (
			await page.screenshot({
				type: "png",
			})
		).toString("base64");
		await page.setContent(
			`<!doctype html><html><body style="margin:60px;font:14px/1.5 Arial"><h1>${TITLE}</h1><p>${BODY} ${MORE}</p><p><img src="data:image/png;base64,${figure}" width="450"></p><p>${CAPTION}</p><p>${MORE}</p></body></html>`,
		);
		return new Uint8Array(
			await page.pdf({
				format: "A4",
			}),
		);
	} finally {
		await page.close();
	}
};

const repositoryOf = async (client: ApiClient, pdf: Uint8Array) => {
	const asset = await uploadAsset(client, `${pipelineName("Report")}.pdf`, {
		content: new Uint8Array(pdf),
		type: "application/pdf",
	});
	const block = await client.block.create({
		type: "repository",
		name: pipelineName("Report Repository"),
		status: "ready",
		assets: [
			asset.id,
		],
		config: {
			minPassages: 1,
			maxPassages: 5,
			defaultPassages: 3,
		},
	});
	return {
		asset,
		repositoryId: block.data.id,
	};
};

/** The report's text passages, lower-cased, and its figure descriptions once the workers prepared it. */
const preparedTexts = async (member: ApiClient, context: BrowserContext) => {
	const { asset, repositoryId } = await repositoryOf(
		member,
		await reportWithFigure(context),
	);
	const readiness = await preparedReadiness(member, repositoryId);
	expect(readiness.totals.ready).toBe(1);

	const { data: points } = await member.assetPoint.browseRepository({
		repositoryId,
		assetId: asset.id,
	});
	const texts = points
		.filter(({ payload }) => payload.source === "text")
		.map(({ payload }) => payload.text)
		.join("\n");
	expect(texts).toContain(TITLE);
	expect(texts).toContain(BODY);
	expect(texts).toContain(CAPTION);
	return {
		texts: texts.toLowerCase(),
		figures: points
			.filter(({ payload }) => payload.source === "image")
			.map(({ payload }) => payload.text),
	};
};

test("pipeline: the text read in a figure stays out of the document's text passages when the figure is described", async ({
	api,
	inference,
	newContext,
	org,
}) => {
	const { providerId } = await setUpChatModel(api, inference);
	const visionModel = await useUtilityModel(api, org.id, providerId, [
		"text",
		"image",
	]);
	inference.respondWith({
		model: visionModel,
		text: FIGURE_DESCRIPTION,
	});

	const { texts, figures } = await preparedTexts(
		api.as("member"),
		await newContext(),
	);
	expect(texts).not.toContain("quokka");
	expect(texts).not.toContain("ledger");
	expect(figures).toEqual([
		FIGURE_DESCRIPTION,
	]);
});

test("pipeline: the text read in a figure stays in the document's text passages when no model describes figures", async ({
	api,
	inference,
	newContext,
}) => {
	await setUpChatModel(api, inference);

	const { texts, figures } = await preparedTexts(
		api.as("member"),
		await newContext(),
	);
	expect(texts).toContain("quokka ledger");
	expect(figures).toEqual([]);
});
