import { expect } from "@playwright/test";
import type { ApiClient } from "../api";

/**
 * Text files uploaded in one call, as one upload entry in the uploader's
 * activity. Without workers their preparation cannot be queued, so each
 * ends failed.
 */
export const uploadTogether = async (
	client: ApiClient,
	names: readonly string[],
) => {
	const content = (name: string) => `Uploaded by the activity spec as ${name}.`;
	const signed = await client.storage.createUploadUrls({
		route: "asset",
		files: names.map((name) => ({
			name,
			size: Buffer.byteLength(content(name)),
			type: "text/plain",
		})),
	});
	const files = [];
	for (const [index, target] of signed.data.entries()) {
		const name = names[index];
		if (target.mode !== "single" || name === undefined) {
			throw new Error("Expected a single upload per file");
		}
		const response = await fetch(target.signedUrl, {
			method: "PUT",
			headers: target.headers,
			body: content(name),
		});
		expect(response.ok).toBe(true);
		files.push(target.file);
	}
	await client.asset.createFromUploads({
		route: "asset",
		files,
	});
};
