import type { MatrixInput } from "@/components/chat/gen-ui/matrix/schema";

/** Four references against the parts of an APA 7 entry. */
export const referenceMatrix = {
	title: "APA 7 reference check",
	columns: [
		{
			key: "authors",
			label: "Authors",
		},
		{
			key: "title",
			label: "Title",
		},
		{
			key: "doi",
			label: "DOI",
		},
	],
	rows: [
		{
			label: "Hattie & Timperley (2007)",
			cells: {
				authors: {
					status: "not_met",
					note: "Use a comma and an ampersand. <cite ref=kgol9ts>§9.8</cite>",
				},
				title: {
					status: "not_met",
					note: "Use sentence case.",
				},
				doi: {
					status: "partial",
					note: "Write the DOI as a URL.",
				},
			},
		},
		{
			label: "Black & Wiliam (1998)",
			cells: {
				authors: {
					status: "met",
					note: "Inverted names with initials.",
				},
				title: {
					status: "met",
				},
				doi: {
					status: "met",
				},
			},
		},
		{
			label: "Shute (2008)",
			cells: {
				authors: {
					status: "met",
				},
				title: {
					status: "n_a",
					note: "The title is cut off in the paste.",
				},
				doi: {
					status: "partial",
					note: "No DOI given.",
				},
			},
		},
	],
} satisfies MatrixInput;
