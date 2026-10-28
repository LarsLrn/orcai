import type { Asset, AssetUploadRoute } from "@orcai/schema";
import { expect, type Page } from "@playwright/test";
import type { ApiClient } from "./api";

/**
 * An asset named `title`, uploaded and created as the app does: sign the
 * upload, put the bytes, create the asset. Only the pipeline specs run
 * workers; elsewhere the processing queue does not exist, so queueing fails
 * and the asset ends up failed. The `chatAttachment` route makes it a chat
 * upload.
 */
export const uploadAsset = async (
	client: ApiClient,
	title: string,
	{
		route = "asset",
		content = `Uploaded by the e2e suite as ${title}.`,
		type = "text/plain",
	}: {
		route?: AssetUploadRoute;
		content?: string | Uint8Array;
		type?: string;
	} = {},
): Promise<Asset> => {
	const signed = await client.storage.createUploadUrls({
		route,
		files: [
			{
				name: title,
				size: Buffer.byteLength(content),
				type,
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
		route,
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
