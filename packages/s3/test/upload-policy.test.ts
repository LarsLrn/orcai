import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { UPLOAD_LIFECYCLE_RULES, validateUploadEnvelope } from "../src/server";
import {
	ASSET_UPLOAD_ACCEPT,
	ASSET_UPLOAD_MIME_TYPES,
	buildUploadPrefix,
	getFileTypeFromMime,
	getMimeTypeFromFileType,
	isMimeAllowed,
	UPLOAD_ROUTES,
	UPLOAD_STAGING_PREFIX,
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

describe("staging", () => {
	const userId = "00000000-0000-4000-8000-0000000000aa";
	const id = "00000000-0000-4000-8000-0000000000bb";

	const envelope = (overrides: Record<string, string> = {}) => {
		const prefix = buildUploadPrefix({
			userId,
			route: "asset",
		});
		return {
			type: "text/plain",
			objectMetadata: {
				id,
				prefix,
				key: `${prefix}/${id}.txt`,
				route: "asset",
				userId,
				bucket: UPLOAD_ROUTES.asset.bucket,
				...overrides,
			},
		};
	};

	const validate = (file: ReturnType<typeof envelope>) =>
		Effect.runSync(
			validateUploadEnvelope({
				file,
				route: "asset",
				userId,
			}).pipe(Effect.result),
		);

	test("uploads land under the staging prefix and their asset outside it", () => {
		const result = validate(envelope());

		expect(Result.isSuccess(result)).toBe(true);
		if (!Result.isSuccess(result)) return;
		expect(result.success.stagingKey.startsWith(UPLOAD_STAGING_PREFIX)).toBe(
			true,
		);
		expect(result.success.key).toBe(
			result.success.stagingKey.slice(UPLOAD_STAGING_PREFIX.length),
		);
		expect(result.success.prefix).toMatch(
			new RegExp(`^users/${userId}/asset/\\d{4}/\\d{2}$`),
		);
	});

	test("the lifecycle rules match staged keys only", () => {
		const result = validate(envelope());
		if (!Result.isSuccess(result)) throw new Error("envelope rejected");

		for (const rule of UPLOAD_LIFECYCLE_RULES) {
			expect(result.success.stagingKey.startsWith(rule.Filter.Prefix)).toBe(
				true,
			);
			expect(result.success.key.startsWith(rule.Filter.Prefix)).toBe(false);
		}
	});

	test("rejects envelopes pointing outside the caller's staging prefix", () => {
		const foreignUser = "00000000-0000-4000-8000-0000000000cc";
		const finalPrefix = envelope().objectMetadata.prefix.slice(
			UPLOAD_STAGING_PREFIX.length,
		);

		const forgeries: Record<string, string>[] = [
			{
				prefix: finalPrefix,
				key: `${finalPrefix}/${id}.txt`,
			},
			{
				prefix: `staging/users/${foreignUser}/asset/2026/10`,
				key: `staging/users/${foreignUser}/asset/2026/10/${id}.txt`,
			},
			{
				key: "staging/elsewhere.txt",
			},
			{
				id: "../escape",
			},
			{
				route: "chatAttachment",
			},
		];

		for (const overrides of forgeries) {
			expect(Result.isFailure(validate(envelope(overrides)))).toBe(true);
		}
	});
});
