import { describe, expect, test } from "bun:test";
import { chatMessageMetadataSchema } from "../src";

const citationsOf = (citations: Record<string, unknown>) =>
	chatMessageMetadataSchema.parse({
		citations,
	}).citations;

describe("stored citations", () => {
	test("keep each kind that passes its schema", () => {
		const citations = {
			kgol9ts: {
				kind: "asset",
				assetId: "asset-a",
				title: "Refund policy",
				page: 4,
			},
			do8r8j2: {
				kind: "docs",
				path: "/docs/using-orcai/bots",
				title: "Bots",
			},
			w2jpxug: {
				kind: "web",
				url: "https://www.who.int/news-room/fact-sheets/detail/malaria",
				title: "Malaria",
			},
		} as const;

		expect(citationsOf(citations)).toEqual(citations);
	});

	test("drop entries that fail their kind's schema", () => {
		expect(
			citationsOf({
				w0000001: {
					kind: "web",
					url: "javascript:alert(1)",
					title: "Script",
				},
				w0000002: {
					kind: "web",
					url: "https://user:secret@example.org/",
					title: "Credentials",
				},
				d0000001: {
					kind: "docs",
					path: "/docs/../app",
					title: "Escape",
				},
				d0000002: {
					kind: "docs",
					path: "/docs/using-orcai/bots.md",
					title: "Not normalised",
				},
				k0000001: {
					assetId: "asset-a",
					title: "Without kind",
				},
			}),
		).toEqual({});
	});
});
