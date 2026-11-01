import { describe, expect, test } from "bun:test";
import { displayToolMarkdown } from "@/components/chat/gen-ui/catalog";

describe("showChecklist markdown", () => {
	test("writes a status list with heading, description, quote and body", () => {
		expect(
			displayToolMarkdown("showChecklist", {
				title: "APA 7 check",
				description: "Four references against the manual.",
				items: [
					{
						label: "Hattie & Timperley (2007)",
						status: "not_met",
						summary: "Authors, Title",
						quote: "Hattie, J. and Timperley, H.\nThe Power of Feedback",
						body: "- **Authors**: use an ampersand. <cite ref=kgol9ts>§9.8</cite>\n\nSee the manual.",
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
				"  - **Authors**: use an ampersand. <cite ref=kgol9ts>§9.8</cite>",
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
			displayToolMarkdown("showChecklist", {
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
		expect(displayToolMarkdown("showChecklist", {})).toBeNull();
		expect(
			displayToolMarkdown("showChecklist", {
				title: "Only a title",
			}),
		).toBe("### Only a title");
		expect(
			displayToolMarkdown("showChecklist", {
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
			displayToolMarkdown("showChecklist", {
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
