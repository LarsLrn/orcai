import { describe, expect, test } from "bun:test";
import { chunkIds, chunkRef } from "./chunk-ref";

describe("chunkRef", () => {
	test("is k and 6 base36 characters, the same for the same chunk", () => {
		const id = "9b2d4c6e-1f3a-4b5c-8d7e-0a1b2c3d4e5f";

		expect(chunkRef(id)).toMatch(/^k[0-9a-z]{6}$/);
		expect(chunkRef(id)).toBe(chunkRef(id));
		expect(chunkRef(id)).not.toBe(
			chunkRef("9b2d4c6e-1f3a-4b5c-8d7e-0a1b2c3d4e60"),
		);
	});

	test("does not depend on the point id's length", () => {
		expect(chunkRef("")).toMatch(/^k[0-9a-z]{6}$/);
		expect(chunkRef("7")).toMatch(/^k[0-9a-z]{6}$/);
	});
});

describe("chunkIds", () => {
	const passage = {
		ref: "k000001",
		id: "point-1",
		assetId: "asset-a",
		title: "Refund policy",
		blockName: "Handbook",
		text: "Refunds are paid within 14 days.",
	};

	test("knows the refs of the passages it was given and of those added since", () => {
		const ids = chunkIds([
			passage,
		]);
		ids.add([
			{
				...passage,
				ref: "k000002",
				id: "point-2",
			},
		]);

		expect(ids.idOf("k000001")).toBe("point-1");
		expect(ids.idOf("k000002")).toBe("point-2");
	});

	test("takes a UUID or an unsigned integer for a point id, and nothing else", () => {
		const ids = chunkIds([]);

		expect(ids.idOf("9b2d4c6e-1f3a-4b5c-8d7e-0a1b2c3d4e5f")).toBe(
			"9b2d4c6e-1f3a-4b5c-8d7e-0a1b2c3d4e5f",
		);
		expect(ids.idOf("42")).toBe("42");
		expect(ids.idOf("k999999")).toBeUndefined();
	});
});
