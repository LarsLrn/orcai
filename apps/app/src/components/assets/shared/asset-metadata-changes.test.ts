import { describe, expect, test } from "bun:test";
import { changedAssetFields } from "./asset-metadata-changes";

describe("changedAssetFields", () => {
	test("keeps only what the user changed, clearing with an empty string", () => {
		expect(
			changedAssetFields(
				{
					title: "refunds.pdf",
					metadata: {
						citationLabel: "",
						author: "Ada",
						doi: "10.1/x",
					},
				},
				{
					title: "Refund policy",
					metadata: {
						citationLabel: "",
						author: "Ada",
						doi: "",
						journalName: "Journal of Policy",
					},
				},
			),
		).toEqual({
			title: "Refund policy",
			metadata: {
				doi: "",
				journalName: "Journal of Policy",
			},
		});
	});

	test("an untouched form changes nothing", () => {
		const draft = {
			title: "Refunds",
			metadata: {
				author: "Ada",
			},
		};

		expect(changedAssetFields(draft, structuredClone(draft))).toEqual({
			metadata: {},
		});
	});
});
