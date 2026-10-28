import { deflateSync } from "node:zlib";
import type { Asset } from "@orcai/schema";
import { expect } from "@playwright/test";
import type { ApiClient } from "../api";

const crcTable = Array.from({
	length: 256,
}).map((_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

const crc32 = (bytes: Buffer): number => {
	let c = 0xffffffff;
	for (const byte of bytes) c = (crcTable[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer): Buffer => {
	const body = Buffer.concat([
		Buffer.from(type, "ascii"),
		data,
	]);
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([
		length,
		body,
		crc,
	]);
};

/** A solid grey PNG, wider than any phone viewport. */
export const widePng = (width = 1600, height = 900): Buffer => {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	header[9] = 2;
	const row = Buffer.concat([
		Buffer.from([
			0,
		]),
		Buffer.alloc(width * 3, 0x88),
	]);
	const pixels = Buffer.concat(
		Array.from({
			length: height,
		}).map(() => row),
	);
	return Buffer.concat([
		Buffer.from([
			0x89,
			0x50,
			0x4e,
			0x47,
			0x0d,
			0x0a,
			0x1a,
			0x0a,
		]),
		chunk("IHDR", header),
		chunk("IDAT", deflateSync(pixels)),
		chunk("IEND", Buffer.alloc(0)),
	]);
};

export const tinyGif = (): Buffer =>
	Buffer.from(
		"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
		"base64",
	);

export const tinyWebp = (): Buffer =>
	Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");

export const tinyPdf = (): Buffer =>
	Buffer.from(
		"%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
	);

/** An asset with binary content, uploaded and created as the app does. */
export const uploadFile = async (
	client: ApiClient,
	name: string,
	type: string,
	content: Buffer,
): Promise<Asset> => {
	const signed = await client.storage.createUploadUrls({
		route: "asset",
		files: [
			{
				name,
				size: content.length,
				type,
			},
		],
	});
	const [target] = signed.data;
	if (target?.mode !== "single") throw new Error("Expected a single upload");

	const response = await fetch(target.signedUrl, {
		method: "PUT",
		headers: target.headers,
		body: new Uint8Array(content),
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
