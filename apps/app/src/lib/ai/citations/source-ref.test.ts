import { describe, expect, test } from "bun:test";
import { SOURCE_REF, sourceRef } from "./source-ref";

describe("sourceRef", () => {
	test("gives the pinned refs of each kind", () => {
		expect(sourceRef("passage", "3f2b8c1e-5d4a-4e7b-9c3a-1f6e2d8b7a90")).toBe(
			"kgol9ts",
		);
		expect(
			sourceRef(
				"web",
				"https://www.who.int/news-room/fact-sheets/detail/malaria",
			),
		).toBe("w2jpxug");
		expect(sourceRef("docs", "/docs/using-orcai/bots")).toBe("do8r8j2");
	});

	test("is the kind's letter and 6 base36 characters, the same for the same identity", () => {
		const id = "9b2d4c6e-1f3a-4b5c-8d7e-0a1b2c3d4e5f";

		expect(sourceRef("passage", id)).toMatch(SOURCE_REF);
		expect(sourceRef("attachment", id)).toMatch(/^a[0-9a-z]{6}$/);
		expect(sourceRef("passage", id)).toBe(sourceRef("passage", id));
		expect(sourceRef("passage", id)).not.toBe(
			sourceRef("passage", "9b2d4c6e-1f3a-4b5c-8d7e-0a1b2c3d4e60"),
		);
	});

	test("does not depend on the identity's length", () => {
		expect(sourceRef("passage", "")).toMatch(SOURCE_REF);
		expect(sourceRef("passage", "7")).toMatch(SOURCE_REF);
	});

	test("gives two identities one ref now and then, as hashes do", () => {
		expect(sourceRef("web", "https://example.com/3f49a11da1fabbf4")).toBe(
			sourceRef("web", "https://example.com/f0afd2db51eaec07"),
		);
	});
});
