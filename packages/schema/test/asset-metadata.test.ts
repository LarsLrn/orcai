import { describe, expect, test } from "bun:test";
import { metadataSchema } from "../src";

describe("metadataSchema", () => {
	test("drops the citation and relevance flags stored before they were removed", () => {
		expect(
			metadataSchema.parse({
				showReference: false,
				relevance: "high",
				author: "Ada Lovelace",
			}),
		).toEqual({
			author: "Ada Lovelace",
		});
	});
});
