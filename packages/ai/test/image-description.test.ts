import { describe, expect, test } from "bun:test";
import {
	figureDescriptionInstructions,
	readImageAssetDescription,
} from "../src/image-description";

describe("figureDescriptionInstructions", () => {
	test("asks for a transcription when the hint names a table", () => {
		expect(figureDescriptionInstructions("Table 2: refunds")).toContain(
			"Transcribe",
		);
		expect(figureDescriptionInstructions("images/image-3.png")).not.toContain(
			"Transcribe",
		);
	});
});

describe("readImageAssetDescription", () => {
	test("trims every field and cuts the description to 300 characters", () => {
		const read = readImageAssetDescription({
			text: " Search text ",
			title: " Title ",
			description: ` ${"a".repeat(400)} `,
			language: " de ",
		});

		expect(read).toEqual({
			text: "Search text",
			suggestion: {
				title: "Title",
				description: "a".repeat(300),
				language: "de",
			},
		});
	});
});
