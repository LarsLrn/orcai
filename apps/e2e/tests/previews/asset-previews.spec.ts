import type { Download, Page } from "@playwright/test";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";
import {
	tinyGif,
	tinyPdf,
	tinyWebp,
	uploadFile,
	widePng,
} from "../../fixtures/previews/files";

const WIDTHS = [
	{
		width: 1280,
		height: 800,
	},
	{
		width: 390,
		height: 844,
	},
];

const fitsViewport = async (page: Page) => {
	const { innerWidth, scrollWidth } = await page.evaluate(() => {
		const browser = globalThis as unknown as {
			innerWidth: number;
			document: {
				documentElement: {
					scrollWidth: number;
				};
			};
		};
		return {
			innerWidth: browser.innerWidth,
			scrollWidth: browser.document.documentElement.scrollWidth,
		};
	});
	expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
};

const images = [
	{
		label: "png",
		ext: "png",
		type: "image/png",
		bytes: widePng,
	},
	{
		label: "tall png",
		ext: "png",
		type: "image/png",
		bytes: () => widePng(600, 1800),
	},
	{
		label: "gif",
		ext: "gif",
		type: "image/gif",
		bytes: tinyGif,
	},
	{
		label: "webp",
		ext: "webp",
		type: "image/webp",
		bytes: tinyWebp,
	},
];

for (const image of images) {
	test(`assets: a ${image.label} previews at 1280 px and 390 px`, async ({
		api,
		org,
		pageAs,
	}) => {
		const title = `E2E Preview ${runId()}.${image.ext}`;
		const asset = await uploadFile(
			api.as("member"),
			title,
			image.type,
			image.bytes(),
		);

		const page = await pageAs("member");
		await enterApp(page, org.slug);

		for (const viewport of WIDTHS) {
			await page.setViewportSize(viewport);
			await open(page, `/app/library/assets/${asset.id}`);
			const preview = page.getByRole("img", {
				name: asset.title,
			});
			await expect(preview).toBeVisible();
			await expect
				.poll(() =>
					preview.evaluate(
						(img) =>
							(
								img as unknown as {
									naturalWidth: number;
								}
							).naturalWidth,
					),
				)
				.toBeGreaterThan(0);
			const box = await preview.boundingBox();
			if (!box) throw new Error("not laid out");
			expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
			expect(box.height).toBeLessThanOrEqual(viewport.height - 110);
			await fitsViewport(page);
			await expect(
				page.getByText(message("assets_file_viewer_unsupported_title")),
			).toHaveCount(0);
		}
	});
}

test("assets: a pdf previews inline at 1280 px and opens in a tab at 390 px", async ({
	api,
	org,
	pageAs,
}) => {
	const title = `E2E Preview ${runId()}.pdf`;
	const asset = await uploadFile(
		api.as("member"),
		title,
		"application/pdf",
		tinyPdf(),
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	const openPdf = page.getByRole("button", {
		name: message("assets_file_viewer_pdf_open"),
	});

	await page.setViewportSize(WIDTHS[0]);
	await open(page, `/app/library/assets/${asset.id}`);
	await expect(page.locator("iframe")).toBeVisible();
	await expect(openPdf).toHaveCount(0);

	await page.setViewportSize(WIDTHS[1]);
	await open(page, `/app/library/assets/${asset.id}`);
	await expect(openPdf).toBeVisible();
	await expect(page.locator("iframe")).toHaveCount(0);
	await fitsViewport(page);

	// The tab opens through a fresh signed URL, never the one captured at load.
	const refreshed = page.waitForRequest((r) =>
		r.url().includes("createDownloadUrl"),
	);
	const served = page.context().waitForEvent("response", {
		predicate: (r) => r.url().includes(asset.id) && r.url().includes(".pdf"),
	});
	const popup = page.waitForEvent("popup");
	await openPdf.click();
	await popup;
	await refreshed;
	const response = await served;
	expect(response.status()).toBe(200);
	expect(response.headers()["content-type"]).toContain("application/pdf");
});

test("assets: the header download saves the file under its name through a fresh signed URL", async ({
	api,
	org,
	pageAs,
}) => {
	const title = `E2E Preview ${runId()}`;
	const asset = await uploadFile(
		api.as("member"),
		title,
		"application/pdf",
		tinyPdf(),
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await page.setViewportSize(WIDTHS[0]);
	await open(page, `/app/library/assets/${asset.id}`);
	const download = page.getByRole("button", {
		name: message("assets_detail_download_button"),
	});
	await expect(download).toBeEnabled();

	const refreshed = page.waitForRequest((r) =>
		r.url().includes("createDownloadUrl"),
	);
	const saved = new Promise<Download>((resolve) => {
		page.context().on("page", (popup) => popup.on("download", resolve));
	});
	await download.click();
	await refreshed;
	expect((await saved).suggestedFilename()).toBe(`${title}.pdf`);
});

test("assets: a failed image load offers a retry", async ({
	api,
	org,
	pageAs,
}) => {
	const asset = await uploadFile(
		api.as("member"),
		`E2E Preview ${runId()}.png`,
		"image/png",
		widePng(),
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	const isImage = (url: URL) =>
		url.href.includes(asset.id) && url.pathname.endsWith(".png");
	await page.route(isImage, (route) => route.abort());
	await open(page, `/app/library/assets/${asset.id}`);
	await expect(
		page.getByText(message("assets_file_viewer_image_error_title")),
	).toBeVisible();

	await page.unroute(isImage);
	await page
		.getByRole("button", {
			name: message("assets_file_viewer_image_retry"),
		})
		.click();
	await expect(
		page.getByRole("img", {
			name: asset.title,
		}),
	).toBeVisible();
});

test("assets: other file types stay unsupported on every width", async ({
	api,
	org,
	pageAs,
}) => {
	const asset = await uploadFile(
		api.as("member"),
		`E2E Preview ${runId()}.txt`,
		"text/plain",
		Buffer.from("plain text"),
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	for (const viewport of WIDTHS) {
		await page.setViewportSize(viewport);
		await open(page, `/app/library/assets/${asset.id}`);
		await expect(
			page.getByText(message("assets_file_viewer_unsupported_title")),
		).toBeVisible();
	}
});
