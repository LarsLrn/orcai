import { describe, expect, test } from "bun:test";
import { organizationIdSchema, userIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import {
	checkUpload,
	checkUploadFile,
	UPLOAD_LIFECYCLE_RULES,
} from "../src/server";
import {
	ASSET_UPLOAD_ACCEPT,
	assetObjectKey,
	buildUploadPrefix,
	getFileTypeFromMime,
	getMimeTypeFromFileType,
	IMAGE_PREFIX,
	type ImageOwner,
	imageKey,
	imagePath,
	mimeTypesFor,
	parseImagePath,
	UPLOAD_ROUTES,
	UPLOAD_STAGING_PREFIX,
	type UploadRouteName,
} from "../src/shared";

describe("file types", () => {
	test("maps modern and legacy office MIME types to file types", () => {
		expect(
			getFileTypeFromMime(
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			),
		).toBe("docx");
		expect(
			getFileTypeFromMime(
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			),
		).toBe("xlsx");
		expect(getFileTypeFromMime("application/x-msword")).toBe("doc");
		expect(getFileTypeFromMime("application/vnd.ms-powerpoint")).toBe("ppt");
		expect(getMimeTypeFromFileType("xls")).toBe("application/vnd.ms-excel");
	});

	test("stores JPEGs as jpeg, the non-standard image/jpg as jpg, and reads x-wav as wav", () => {
		expect(getFileTypeFromMime("image/jpeg")).toBe("jpeg");
		expect(getFileTypeFromMime("image/jpg")).toBe("jpg");
		expect(getMimeTypeFromFileType("jpg")).toBe("image/jpeg");
		expect(getFileTypeFromMime("audio/x-wav")).toBe("wav");
		expect(getFileTypeFromMime("text/plain; charset=utf-8")).toBe("txt");
		expect(getFileTypeFromMime("video/webm")).toBe("unknown");
	});
});

describe("upload routes", () => {
	test("accept these MIME types", () => {
		const office = [
			"application/msword",
			"application/x-msword",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/vnd.ms-excel",
			"application/msexcel",
			"application/x-msexcel",
			"application/x-ms-excel",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"application/vnd.ms-powerpoint",
			"application/mspowerpoint",
			"application/powerpoint",
			"application/x-mspowerpoint",
			"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		];
		const common = [
			"image/jpeg",
			"image/jpg",
			"image/png",
			"image/gif",
			"image/webp",
			"application/pdf",
			"text/plain",
			"text/csv",
			"text/markdown",
		];
		const accepted = (route: UploadRouteName) =>
			new Set(mimeTypesFor(UPLOAD_ROUTES[route].fileTypes));

		expect(accepted("asset")).toEqual(
			new Set([
				...common,
				...office,
			]),
		);
		expect(accepted("chatAttachment")).toEqual(
			new Set([
				...common,
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				"application/vnd.openxmlformats-officedocument.presentationml.presentation",
			]),
		);
		expect(accepted("profileImage")).toEqual(
			new Set([
				"image/webp",
			]),
		);
	});

	test("the asset picker offers every accepted type with its extensions", () => {
		expect(new Set(Object.keys(ASSET_UPLOAD_ACCEPT))).toEqual(
			new Set(mimeTypesFor(UPLOAD_ROUTES.asset.fileTypes)),
		);
		expect(ASSET_UPLOAD_ACCEPT["image/jpeg"]).toEqual([
			".jpeg",
			".jpg",
		]);
	});

	test("a route refuses a type or a size it does not take", () => {
		const check = (route: UploadRouteName, type: string, size: number) =>
			Effect.runSync(
				checkUploadFile(route, {
					name: "file",
					type,
					size,
				}).pipe(
					Effect.match({
						onFailure: (error) => error.rejection.reason,
						onSuccess: (fileType) => fileType,
					}),
				),
			);

		expect(check("asset", "image/jpg", 1)).toBe("jpg");
		expect(check("asset", "video/mp4", 1)).toBe("UPLOAD_FILE_TYPE_INVALID");
		expect(check("asset", "text/plain; charset=utf-8", 1)).toBe(
			"UPLOAD_FILE_TYPE_INVALID",
		);
		expect(check("chatAttachment", "application/msword", 1)).toBe(
			"UPLOAD_FILE_TYPE_INVALID",
		);
		expect(check("profileImage", "image/png", 1)).toBe(
			"UPLOAD_FILE_TYPE_INVALID",
		);
		expect(check("asset", "text/plain", UPLOAD_ROUTES.asset.maxFileSize)).toBe(
			"txt",
		);
		expect(
			check("asset", "text/plain", UPLOAD_ROUTES.asset.maxFileSize + 1),
		).toBe("UPLOAD_FILE_TOO_LARGE");
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
			name: "notes.txt",
			type: "text/plain",
			size: 5,
			objectMetadata: {
				id,
				prefix,
				key: assetObjectKey({
					prefix,
					id,
					fileType: "txt",
				}),
				route: "asset",
				userId,
				bucket: UPLOAD_ROUTES.asset.bucket,
				...overrides,
			},
		};
	};

	const validate = (file: ReturnType<typeof envelope>) =>
		Effect.runSync(
			checkUpload({
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
		expect(result.success.key).toBe(`${result.success.prefix}/${id}.txt`);
	});

	test("lifecycle expires staged uploads, never final keys", () => {
		const result = validate(envelope());
		if (!Result.isSuccess(result)) throw new Error("envelope rejected");
		const expires = (key: string) =>
			UPLOAD_LIFECYCLE_RULES.some((rule) => key.startsWith(rule.Filter.Prefix));

		expect(expires(result.success.stagingKey)).toBe(true);
		expect(expires(result.success.key)).toBe(false);
		expect(
			expires(
				imageKey(
					{
						kind: "user",
						userId: userIdSchema.parse(userId),
					},
					id,
				),
			),
		).toBe(false);
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
			{
				key: assetObjectKey({
					prefix: envelope().objectMetadata.prefix,
					id,
					fileType: "pdf",
				}),
			},
		];

		for (const overrides of forgeries) {
			const result = validate(envelope(overrides));
			expect(Result.isFailure(result) && result.failure.rejection.reason).toBe(
				"UPLOAD_REQUEST_INVALID",
			);
		}
	});
});

describe("image paths", () => {
	const userId = userIdSchema.parse("00000000-0000-4000-8000-0000000000aa");
	const organizationId = organizationIdSchema.parse(
		"00000000-0000-4000-8000-0000000000bb",
	);
	const id = "00000000-0000-4000-8000-0000000000cc";

	test("a built path parses back to its owner and its key under the image prefix", () => {
		const owners: ImageOwner[] = [
			{
				kind: "user",
				userId,
			},
			{
				kind: "organization",
				organizationId,
			},
		];
		for (const owner of owners) {
			const path = imagePath(owner, id);
			const parsed = parseImagePath(path);

			expect(parsed?.owner).toEqual(owner);
			expect(parsed?.key.startsWith(IMAGE_PREFIX)).toBe(true);
			expect(`/api/${parsed?.key}`).toBe(path);
		}
	});

	test("rejects paths outside the layout", () => {
		for (const path of [
			"https://example.com/avatar.png",
			`/api/images/users/${userId}/${id}.png`,
			`/api/images/users/${userId}/../${id}.webp`,
			`/api/images/users/not-a-uuid/${id}.webp`,
			`/api/images/groups/${userId}/${id}.webp`,
			`/api/images/users/${userId}/${id}.webp?x=1`,
			`/api/staging/users/${userId}/${id}.webp`,
			`images/users/${userId}/${id}.webp`,
		]) {
			expect(parseImagePath(path)).toBeUndefined();
		}
	});
});
