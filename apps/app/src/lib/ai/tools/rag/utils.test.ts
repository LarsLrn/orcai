import { describe, expect, test } from "bun:test";
import { unsearchableDocuments } from "./utils";

const repository = (
	name: string,
	totals: {
		ready: number;
		preparing: number;
		failed: number;
	},
) => ({
	name,
	totals: {
		...totals,
		total: totals.ready + totals.preparing + totals.failed,
	},
});

describe("unsearchableDocuments", () => {
	test("leaves out repositories whose documents are all searchable", () => {
		expect(
			unsearchableDocuments([
				repository("Handbook", {
					ready: 3,
					preparing: 0,
					failed: 0,
				}),
			]),
		).toEqual([]);
	});

	test("counts preparing and failed documents and says so", () => {
		expect(
			unsearchableDocuments([
				repository("Handbook", {
					ready: 38,
					preparing: 80,
					failed: 2,
				}),
				repository("Slides", {
					ready: 0,
					preparing: 1,
					failed: 0,
				}),
			]),
		).toEqual([
			{
				repository: "Handbook",
				ready: 38,
				total: 120,
				preparing: 80,
				failed: 2,
				note: "38 of 120 documents in Handbook are searchable. 80 are still being prepared. 2 could not be prepared.",
			},
			{
				repository: "Slides",
				ready: 0,
				total: 1,
				preparing: 1,
				failed: 0,
				note: "0 of 1 documents in Slides are searchable. 1 is still being prepared.",
			},
		]);
	});
});
