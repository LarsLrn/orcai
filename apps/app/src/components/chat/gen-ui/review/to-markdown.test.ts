import { describe, expect, test } from "bun:test";
import { reviewToMarkdown } from "@/components/chat/gen-ui/review/to-markdown";

describe("reviewToMarkdown", () => {
	test("writes items with status, quoted text, findings and revision", () => {
		expect(
			reviewToMarkdown({
				title: "APA 7 check",
				summary:
					'Two entries need work. <cite title="APA" page="286">§9.8</cite>',
				items: [
					{
						label: "Hattie & Timperley (2007)",
						text: "Hattie, J. and Timperley, H. (2007).\nThe Power of Feedback.",
						revised:
							"Hattie, J., & Timperley, H. (2007). *The power of feedback*.",
						findings: [
							{
								label: "Authors",
								severity: "error",
								note: 'Use an ampersand. <cite title="APA" page="286">§9.8</cite>',
								excerpt: "Hattie, J. and Timperley, H.",
							},
							{
								label: "Title",
								severity: "warning",
								note: "Sentence case.\n\nSee the manual.",
							},
						],
					},
					{
						label: "Black & Wiliam (1998)",
						text: "Black, P., & Wiliam, D. (1998).",
						findings: [],
					},
				],
				general: [
					{
						label: "Order",
						severity: "info",
						note: "Alphabetical.",
					},
				],
			}),
		).toBe(
			[
				"### APA 7 check",
				"",
				'Two entries need work. <cite title="APA" page="286">§9.8</cite>',
				"",
				"**Hattie & Timperley (2007)** (Not met)",
				"",
				"> Hattie, J. and Timperley, H. (2007).",
				"> The Power of Feedback.",
				"",
				'- **Authors** (Error): Use an ampersand. <cite title="APA" page="286">§9.8</cite> ("Hattie, J. and Timperley, H.")',
				"- **Title** (Warning): Sentence case.",
				"",
				"  See the manual.",
				"",
				"**Revised:** Hattie, J., & Timperley, H. (2007). *The power of feedback*.",
				"",
				"**Black & Wiliam (1998)** (Met)",
				"",
				"> Black, P., & Wiliam, D. (1998).",
				"",
				"**Overall**",
				"",
				"- **Order** (Info): Alphabetical.",
			].join("\n"),
		);
	});

	test("tolerates partial input", () => {
		expect(
			reviewToMarkdown({
				items: [
					undefined,
					{
						label: "Streaming",
						findings: [
							undefined,
							{
								severity: "err" as never,
								note: "Half a note",
							},
						],
					},
				],
				general: [
					undefined,
				],
			}),
		).toBe(
			[
				"**Streaming**",
				"",
				"- Half a note",
			].join("\n"),
		);
		expect(reviewToMarkdown({})).toBe("");
	});
});
