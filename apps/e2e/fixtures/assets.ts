import type { Asset } from "@orcai/schema";
import { expect, type Page } from "@playwright/test";
import type { ApiClient } from "./api";

/**
 * A text asset named `title`, uploaded and created as the app does: sign the
 * upload, put the bytes, create the asset. Its processing job stays queued,
 * since the suite runs no workers.
 */
export const uploadAsset = async (
	client: ApiClient,
	title: string,
): Promise<Asset> => {
	const content = `Uploaded by the e2e suite as ${title}.`;
	const signed = await client.storage.createUploadUrls({
		route: "asset",
		files: [
			{
				name: title,
				size: Buffer.byteLength(content),
				type: "text/plain",
			},
		],
	});
	const [target] = signed.data;
	if (target?.mode !== "single") throw new Error("Expected a single upload");

	const response = await fetch(target.signedUrl, {
		method: "PUT",
		headers: target.headers,
		body: content,
	});
	expect(response.ok).toBe(true);

	const {
		data: [result],
	} = await client.asset.createFromUploads({
		route: "asset",
		files: [
			target.file,
		],
	});
	if (result?.status !== "created") {
		throw new Error(`Asset not created: ${JSON.stringify(result)}`);
	}
	return result.asset;
};

/**
 * Holds every staged upload the page puts until `release`, so a spec can act
 * while an upload is in flight. A held upload the app aborts just ends.
 */
export const holdUploads = async (
	page: Page,
): Promise<{
	release: () => void;
}> => {
	let release: () => void = () => undefined;
	const released = new Promise<void>((resolve) => {
		release = resolve;
	});

	await page.route(
		(url) => url.pathname.includes("/staging/"),
		async (route) => {
			if (route.request().method() === "PUT") await released;
			await route.continue().catch(() => undefined);
		},
	);

	return {
		release,
	};
};
