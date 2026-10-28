import { describe, expect, test } from "bun:test";
import { createAssetsFromUploadsInputSchema } from "../src";

describe("asset intake input", () => {
	const file = {
		objectKey: "00000000-0000-4000-8000-0000000000aa",
		objectMetadata: {},
		name: "picture.webp",
		size: 1,
		type: "image/webp",
	};

	test("takes the asset routes and refuses the image routes", () => {
		for (const route of [
			"asset",
			"chatAttachment",
		])
			expect(
				createAssetsFromUploadsInputSchema.safeParse({
					route,
					files: [
						file,
					],
				}).success,
			).toBe(true);

		for (const route of [
			"profileImage",
			"organizationLogo",
		])
			expect(
				createAssetsFromUploadsInputSchema.safeParse({
					route,
					files: [
						file,
					],
				}).success,
			).toBe(false);
	});
});
