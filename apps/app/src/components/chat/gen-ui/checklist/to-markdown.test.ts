import { describe, expect, test } from "bun:test";
import { checklistToMarkdown } from "@/components/chat/gen-ui/checklist/to-markdown";

describe("checklistToMarkdown", () => {
	test("writes a status list with heading, description, quote and body", () => {
		expect(
			checklistToMarkdown({
				title: "APA 7 check",
				description: "Four references against the manual.",
				items: [
					{
						label: "Hattie & Timperley (2007)",
						status: "not_met",
						summary: "Authors, Title",
						quote: "Hattie, J. and Timperley, H.\nThe Power of Feedback",
						body: '- **Authors**: use an ampersand. <cite title="APA" page="286">§9.8</cite>\n\nSee the manual.',
					},
					{
						label: "Black & Wiliam (1998)",
						status: "met",
						summary: "No changes needed",
					},
					{
						label: "Reference list order",
						status: "partial",
						body: "Shute comes before Wisniewski.",
					},
				],
			}),
		).toBe(
			[
				"### APA 7 check",
				"",
				"Four references against the manual.",
				"",
				"- **Hattie & Timperley (2007)** (Not met): Authors, Title",
				"",
				"  > Hattie, J. and Timperley, H.",
				"  > The Power of Feedback",
				"",
				'  - **Authors**: use an ampersand. <cite title="APA" page="286">§9.8</cite>',
				"",
				"  See the manual.",
				"",
				"- **Black & Wiliam (1998)** (Met): No changes needed",
				"",
				"- **Reference list order** (Partly met)",
				"",
				"  Shute comes before Wisniewski.",
			].join("\n"),
		);
	});

	test("writes a plain list as a tight list without statuses", () => {
		expect(
			checklistToMarkdown({
				items: [
					{
						label: "Author lists",
						summary: "Surname, initials",
					},
					{
						label: "DOIs",
					},
				],
			}),
		).toBe(
			[
				"- **Author lists**: Surname, initials",
				"- **DOIs**",
			].join("\n"),
		);
	});

	test("tolerates missing fields", () => {
		expect(checklistToMarkdown({})).toBe("");
		expect(
			checklistToMarkdown({
				title: "Only a title",
			}),
		).toBe("### Only a title");
		expect(
			checklistToMarkdown({
				items: [
					undefined,
					{},
					{
						summary: "Summary without label",
					},
					{
						status: "n_a",
					},
					{
						label: "Half a la",
					},
				],
			}),
		).toBe(
			[
				"- Summary without label",
				"- (Not checkable)",
				"- **Half a la**",
			].join("\n"),
		);
	});

	test("ignores a status outside the vocabulary", () => {
		expect(
			checklistToMarkdown({
				items: [
					{
						label: "Odd",
						status: "unknown" as "met",
					},
				],
			}),
		).toBe("- **Odd**");
	});
});
