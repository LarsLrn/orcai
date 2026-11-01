import { describe, expect, test } from "bun:test";
import { displayToolMarkdown } from "@/components/chat/gen-ui/catalog";
import { referenceMatrix } from "@/components/chat/gen-ui/matrix/fixtures";

describe("showMatrix markdown", () => {
	test("writes a table of status labels and the notes", () => {
		expect(displayToolMarkdown("showMatrix", referenceMatrix)).toBe(
			[
				"### APA 7 reference check",
				"",
				"|  | Authors | Title | DOI |",
				"| --- | :-: | :-: | :-: |",
				"| Hattie & Timperley (2007) | Not met | Not met | Partly met |",
				"| Black & Wiliam (1998) | Met | Met | Met |",
				"| Shute (2008) | Met | Not checkable | Partly met |",
				"",
				"- **Hattie & Timperley (2007), Authors** (Not met): Use a comma and an ampersand. <cite ref=kgol9ts>§9.8</cite>",
				"- **Hattie & Timperley (2007), Title** (Not met): Use sentence case.",
				"- **Hattie & Timperley (2007), DOI** (Partly met): Write the DOI as a URL.",
				"- **Shute (2008), Title** (Not checkable): The title is cut off in the paste.",
				"- **Shute (2008), DOI** (Partly met): No DOI given.",
			].join("\n"),
		);
	});

	test("escapes pipes and leaves missing cells empty", () => {
		expect(
			displayToolMarkdown("showMatrix", {
				columns: [
					{
						key: "a",
						label: "A | B",
					},
					{
						key: "c",
						label: "C",
					},
				],
				rows: [
					{
						label: "Row",
						cells: {
							a: {
								status: "met",
							},
						},
					},
					undefined,
				],
			}),
		).toBe(
			[
				"|  | A \\| B | C |",
				"| --- | :-: | :-: |",
				"| Row | Met |  |",
			].join("\n"),
		);
		expect(displayToolMarkdown("showMatrix", {})).toBeNull();
	});
});
