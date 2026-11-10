import type { BrowserContext } from "@playwright/test";
import { uploadAsset } from "../../fixtures/assets";
import { setUpChatModel } from "../../fixtures/chat/chat";
import type { ApiClient } from "../../fixtures/index";
import { expect, test } from "../../fixtures/index";
import { completionRequests } from "../../fixtures/inference/requests";
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

const NOTICE = [
	"Snow Clearing Notice",
	"Owners clear the pavement in front of their property by seven in the morning.",
	"The cleared path is at least one metre wide and is gritted with sand when it is icy.",
];
const DESCRIPTION = "A scanned notice about snow clearing on pavements.";

/** A PDF whose one page is an image of `NOTICE`, as a scanner makes it: the page has no text of its own. */
const scannedNotice = async (context: BrowserContext) => {
	const page = await context.newPage();
	try {
		await page.setViewportSize({
			width: 1240,
			height: 1754,
		});
		await page.setContent(
			`<body style="margin:0;background:#fff"><div style="padding:150px 140px;font:32px/1.5 'Times New Roman',serif">${NOTICE.map((line) => `<p>${line}</p>`).join("")}</div></body>`,
		);
		const scan = (
			await page.screenshot({
				type: "png",
			})
		).toString("base64");
		await page.setContent(
			`<!doctype html><html><head><style>@page{margin:0}body{margin:0}img{display:block;width:210mm;height:296mm}</style></head><body><img src="data:image/png;base64,${scan}"></body></html>`,
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
	const asset = await uploadAsset(client, `${pipelineName("Notice")}.pdf`, {
		content: new Uint8Array(pdf),
		type: "application/pdf",
	});
	const block = await client.block.create({
		type: "repository",
		name: pipelineName("Notice Repository"),
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

test("pipeline: a scanned page is indexed once, from the text OCR read on it with its page, and its page image is not described", async ({
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
		text: DESCRIPTION,
	});
	const member = api.as("member");
	const { asset, repositoryId } = await repositoryOf(
		member,
		await scannedNotice(await newContext()),
	);
	const readiness = await preparedReadiness(member, repositoryId);
	expect(readiness.totals.ready).toBe(1);

	const { data: points } = await member.assetPoint.browseRepository({
		repositoryId,
		assetId: asset.id,
	});
	expect(points.map(({ payload }) => payload.source)).toEqual([
		"text",
	]);
	expect(points[0]?.payload.text).toContain("Snow Clearing Notice");
	expect(points[0]?.payload.text).toContain("gritted with sand");
	expect(points[0]?.payload).toMatchObject({
		chunkPageStart: 1,
		chunkPageEnd: 1,
	});
	const imageCalls = completionRequests(inference).filter(
		(request) =>
			request.model === visionModel &&
			JSON.stringify(request).includes("image_url"),
	);
	expect(imageCalls).toEqual([]);
});
