import type { ReviewInput } from "@/components/chat/gen-ui/review/schema";

const apa = (page: number, text: string) =>
	`<cite title="APA Publication Manual, 7th ed." page="${page}">${text}</cite>`;
const guide = (page: number, text: string) =>
	`<cite title="Institute Referencing Guide 2025" page="${page}">${text}</cite>`;
const handbook = (page: number, text: string) =>
	`<cite title="Learning Outcomes Handbook" page="${page}">${text}</cite>`;

/** An APA 7 check of a reference list. */
export const referenceReview = {
	title: "APA 7 reference check",
	items: [
		{
			label: "Hattie & Timperley (2007)",
			text: "Hattie, J. and Timperley, H. (2007). The Power of Feedback. Review of Educational Research, 77(1), 81-112. doi:10.3102/003465430298487",
			revised:
				"Hattie, J., & Timperley, H. (2007). The power of feedback. *Review of Educational Research*, *77*(1), 81–112. https://doi.org/10.3102/003465430298487",
			findings: [
				{
					label: "Authors",
					severity: "error",
					note: `Two authors are joined with "and"; APA uses a comma and an ampersand. ${apa(286, "§9.8")}`,
					excerpt: "Hattie, J. and Timperley, H.",
				},
				{
					label: "Title",
					severity: "error",
					note: `Article titles are in sentence case. ${apa(292, "§9.19")}`,
					excerpt: "The Power of Feedback",
				},
				{
					label: "Source",
					severity: "warning",
					note: `The page range needs an en dash. ${guide(4, "Guide p. 4")}`,
					excerpt: "81-112",
				},
				{
					label: "DOI",
					severity: "error",
					note: `Write the DOI as a URL. ${apa(299, "§9.34")}`,
					excerpt: "doi:10.3102/003465430298487",
				},
			],
		},
		{
			label: "Black & Wiliam (1998)",
			text: "Black, P., & Wiliam, D. (1998). Assessment and classroom learning. Assessment in Education: Principles, Policy & Practice, 5(1), 7–74. https://doi.org/10.1080/0969595980050102",
			findings: [],
		},
		{
			label: "Shute (2008)",
			text: "Shute, V. J. (2008). Focus on formative feedback. Review of Educational Research, 78(1), 153-189.",
			revised:
				"Shute, V. J. (2008). Focus on formative feedback. *Review of Educational Research*, *78*(1), 153–189. https://doi.org/10.3102/0034654307313795",
			findings: [
				{
					label: "Source",
					severity: "warning",
					note: "Use an en dash (153–189).",
					excerpt: "153-189",
				},
				{
					label: "DOI",
					severity: "warning",
					note: `No DOI given; APA includes it whenever available. ${apa(299, "§9.34")}`,
				},
			],
		},
		{
			label: "Wisniewski et al. (2020)",
			text: "Wisniewski, Zierer, Hattie (2020). The power of feedback revisited: A meta-analysis of educational feedback research. Frontiers in Psychology, 10, 3087.",
			revised:
				"Wisniewski, B., Zierer, K., & Hattie, J. (2020). The power of feedback revisited: A meta-analysis of educational feedback research. *Frontiers in Psychology*, *10*, Article 3087. https://doi.org/10.3389/fpsyg.2019.03087",
			findings: [
				{
					label: "Authors",
					severity: "error",
					note: `Initials are missing. ${apa(286, "§9.8")}`,
					excerpt: "Wisniewski, Zierer, Hattie",
				},
				{
					label: "Source",
					severity: "warning",
					note: `An article number replaces the page range. ${apa(294, "§9.27")}`,
					excerpt: "10, 3087",
				},
				{
					label: "In-text",
					severity: "error",
					note: "The paragraph cites 2019 but the entry says 2020.",
					excerpt: "(Wisniewski et al., 2019)",
				},
			],
		},
	],
	general: [
		{
			label: "Every in-text citation has a reference entry",
			severity: "error",
			note: "(Kluger & DeNisi, 1996) is cited but missing from the list.",
		},
		{
			label: "Reference list is in alphabetical order",
			severity: "error",
			note: `Order by first author's surname. ${guide(4, "Guide p. 4")}`,
		},
		{
			label: "Hanging indent and double spacing",
			severity: "info",
			note: "Can't be checked from pasted plain text.",
		},
	],
} satisfies ReviewInput;

/** A check of module learning outcomes against a handbook. */
export const outcomesReview = {
	title: "Learning outcomes review",
	summary: `Two outcomes need rewriting and one needs a small addition. ${handbook(6, "Handbook p. 6")}`,
	items: [
		{
			label: "Outcome 1",
			text: "Students will understand the main qualitative research methods.",
			revised:
				"Compare the strengths and limitations of three qualitative research methods for a given research question.",
			findings: [
				{
					label: "Observable verb",
					severity: "error",
					note: `"Understand" can't be observed or assessed. ${handbook(6, "p. 6")}`,
					excerpt: "understand",
				},
				{
					label: "Stem",
					severity: "warning",
					note: 'Drop "Students will".',
					excerpt: "Students will",
				},
				{
					label: "Specificity",
					severity: "warning",
					note: '"The main" methods is open-ended.',
					excerpt: "the main qualitative research methods",
				},
			],
		},
		{
			label: "Outcome 2",
			text: "Design a mixed-methods study that answers a stakeholder-defined research question, justifying each methodological choice.",
			findings: [],
		},
		{
			label: "Outcome 4",
			text: "Critically evaluate published impact case studies.",
			revised:
				"Critically evaluate published impact case studies against the criteria of reach and significance.",
			findings: [
				{
					label: "Criteria",
					severity: "warning",
					note: "Name what the evaluation is against.",
					excerpt: "published impact case studies",
				},
			],
		},
	],
	general: [
		{
			label: "Assessment alignment",
			severity: "error",
			note: `No outcome is evidenced by the oral presentation. ${handbook(11, "p. 11")}`,
		},
		{
			label: "Number of outcomes",
			severity: "info",
			note: "Four is within the usual four to six.",
		},
	],
} satisfies ReviewInput;
