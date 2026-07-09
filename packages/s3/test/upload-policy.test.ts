import { describe, expect, test } from "bun:test";
import {
	ASSET_UPLOAD_ACCEPT,
	ASSET_UPLOAD_MIME_TYPES,
	getFileTypeFromMime,
	getMimeTypeFromFileType,
	isMimeAllowed,
	UPLOAD_ROUTES,
} from "../src/shared";

describe("file type helpers", () => {
	test("maps modern and legacy office MIME types to file types", () => {
		expect(
			getFileTypeFromMime(
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			),
		).toBe("docx");
		expect(
			getFileTypeFromMime(
				"application/vnd.openxmlformats-officedocument.presentationml.presentation",
			),
		).toBe("pptx");
		expect(
			getFileTypeFromMime(
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			),
		).toBe("xlsx");
		expect(getFileTypeFromMime("application/msword")).toBe("doc");
		expect(getFileTypeFromMime("application/vnd.ms-powerpoint")).toBe("ppt");
		expect(getFileTypeFromMime("application/vnd.ms-excel")).toBe("xls");
	});

	test("maps office file types to canonical MIME types", () => {
		expect(getMimeTypeFromFileType("docx")).toBe(
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		);
		expect(getMimeTypeFromFileType("pptx")).toBe(
			"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		);
		expect(getMimeTypeFromFileType("xlsx")).toBe(
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		);
		expect(getMimeTypeFromFileType("doc")).toBe("application/msword");
		expect(getMimeTypeFromFileType("ppt")).toBe(
			"application/vnd.ms-powerpoint",
		);
		expect(getMimeTypeFromFileType("xls")).toBe("application/vnd.ms-excel");
	});
});

describe("asset upload policy", () => {
	test("derives route MIME policy and UI accept map from the same MIME set", () => {
		expect(UPLOAD_ROUTES.asset.allowedMimePatterns).toEqual(
			ASSET_UPLOAD_MIME_TYPES,
		);

		for (const mimeType of ASSET_UPLOAD_MIME_TYPES) {
			expect(ASSET_UPLOAD_ACCEPT[mimeType]).toBeDefined();
		}
	});

	test("allows supported asset MIME types and rejects unsupported types", () => {
		expect(
			isMimeAllowed({
				mimeType:
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				allowedMimePatterns: UPLOAD_ROUTES.asset.allowedMimePatterns,
			}),
		).toBe(true);
		expect(
			isMimeAllowed({
				mimeType: "application/vnd.ms-excel",
				allowedMimePatterns: UPLOAD_ROUTES.asset.allowedMimePatterns,
			}),
		).toBe(true);
		expect(
			isMimeAllowed({
				mimeType: "video/mp4",
				allowedMimePatterns: UPLOAD_ROUTES.asset.allowedMimePatterns,
			}),
		).toBe(false);
	});
});
