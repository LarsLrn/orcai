import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { readReview } from "@/components/chat/gen-ui/review/findings";
import {
	outcomesReview,
	referenceReview,
} from "@/components/chat/gen-ui/review/fixtures";
import { reviewSchema } from "@/components/chat/gen-ui/review/schema";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	orpc: {},
}));

const { Review } = await import("@/components/chat/gen-ui/review/review");

const written: Record<string, Blob | Promise<Blob>>[] = [];

class StubClipboardItem {
	constructor(readonly items: Record<string, Blob | Promise<Blob>>) {}
}

beforeEach(() => {
	written.length = 0;
	globalThis.ClipboardItem = StubClipboardItem as never;
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: {
			write: (items: StubClipboardItem[]) => {
				written.push(...items.map((item) => item.items));
				return Promise.resolve();
			},
		},
	});
});

afterEach(cleanup);

/** The clipboard's last write, each type read as text. */
const lastCopy = async () => {
	const item = written.at(-1);
	if (!item) {
		throw new Error("Nothing was copied");
	}
	return {
		html: await (await item["text/html"]).text(),
		plain: await (await item["text/plain"]).text(),
	};
};

const rowOf = (label: string) => {
	const row = screen
		.getByText(label, {
			exact: true,
		})
		.closest("li");
	if (!row) {
		throw new Error(`No row for ${label}`);
	}
	return row;
};

const marksOf = (row: HTMLElement) =>
	[
		...row.querySelectorAll("mark"),
	].map((mark) => mark.textContent);

const iconNames = (element: HTMLElement) =>
	within(element)
		.queryAllByRole("img")
		.map((icon) => icon.getAttribute("aria-label"));

describe("reviewSchema", () => {
	test("accepts the reference list and the learning outcomes", () => {
		expect(reviewSchema.safeParse(referenceReview).success).toBe(true);
		expect(reviewSchema.safeParse(outcomesReview).success).toBe(true);
	});

	test("rejects an item without findings", () => {
		expect(
			reviewSchema.safeParse({
				title: "Check",
				items: [
					{
						label: "One",
						text: "Text",
					},
				],
			}).success,
		).toBe(false);
	});
});

describe("Review", () => {
	test("renders the header with title and a tally of item statuses", () => {
		const { container } = render(
			<Review view={readReview(referenceReview)} streaming={false} />,
		);

		expect(
			screen.getByRole("heading", {
				name: "APA 7 reference check",
			}),
		).toBeDefined();
		const header = container.querySelector("h3")?.parentElement as HTMLElement;
		expect(
			within(header)
				.getAllByRole("img")
				.map((icon) => [
					icon.getAttribute("aria-label"),
					icon.parentElement?.textContent,
				]),
		).toEqual([
			[
				"Not met",
				"2",
			],
			[
				"Partly met",
				"1",
			],
			[
				"Met",
				"1",
			],
		]);
	});

	test("derives each item's icon from its worst finding", () => {
		render(<Review view={readReview(referenceReview)} streaming={false} />);

		expect(iconNames(rowOf("Hattie & Timperley (2007)"))[0]).toBe("Not met");
		expect(iconNames(rowOf("Shute (2008)"))[0]).toBe("Partly met");
		const black = rowOf("Black & Wiliam (1998)");
		expect(iconNames(black)).toEqual([
			"Met",
		]);
		expect(within(black).getByText("No findings")).toBeDefined();
	});

	test("names finding icons by severity", () => {
		render(<Review view={readReview(referenceReview)} streaming={false} />);

		expect(iconNames(rowOf("Shute (2008)")).slice(1)).toEqual([
			"Warning",
			"Warning",
		]);
		expect(iconNames(rowOf("Overall"))).toEqual([
			"Error",
			"Error",
			"Info",
		]);
	});

	test("underlines excerpts with footnote numbers in text order", () => {
		render(<Review view={readReview(outcomesReview)} streaming={false} />);

		const row = rowOf("Outcome 1");
		expect(marksOf(row)).toEqual([
			"Students will1",
			"understand2",
			"the main qualitative research methods3",
		]);
		const numbered = [
			...row.querySelectorAll("ul li"),
		].map((finding) => [
			finding.querySelector("sup")?.textContent,
			finding.querySelector(".font-medium")?.textContent,
		]);
		expect(numbered).toEqual([
			[
				"2",
				"2Observable verb",
			],
			[
				"1",
				"1Stem",
			],
			[
				"3",
				"3Specificity",
			],
		]);
	});

	test("leaves an excerpt missing from the text unnumbered", () => {
		render(<Review view={readReview(referenceReview)} streaming={false} />);

		const row = rowOf("Wisniewski et al. (2020)");
		expect(marksOf(row)).toEqual([
			"Wisniewski, Zierer, Hattie1",
			"10, 30872",
		]);
		const inText = within(row).getByText("In-text").closest("li");
		expect(inText?.querySelector("sup")).toBeNull();
	});

	test("shows the summary and general findings last as Overall", () => {
		const { container } = render(
			<Review view={readReview(outcomesReview)} streaming={false} />,
		);

		expect(screen.getByText(/Two outcomes need rewriting/)).toBeDefined();
		const rows = container.querySelectorAll(":scope > div > ul > li");
		expect(rows[rows.length - 1].textContent).toContain("Overall");
		expect(rows[rows.length - 1].textContent).toContain("Assessment alignment");
	});

	test("has no view switch without revisions", () => {
		render(
			<Review
				view={readReview({
					title: "No revisions",
					items: [
						referenceReview.items[1],
					],
				})}
				streaming={false}
			/>,
		);

		expect(screen.queryByRole("group")).toBeNull();
		expect(screen.queryByText("Changes")).toBeNull();
	});

	test("shows a word diff in Changes, stacked for a rewrite", () => {
		const { container } = render(
			<Review view={readReview(outcomesReview)} streaming={false} />,
		);

		fireEvent.click(
			screen.getByRole("button", {
				name: "Changes",
			}),
		);

		const outcome4 = rowOf("Outcome 4");
		expect(
			[
				...outcome4.querySelectorAll("ins"),
			].map((token) => token.textContent),
		).toEqual([
			"studies",
			"against",
			"the",
			"criteria",
			"of",
			"reach",
			"and",
			"significance.",
		]);
		expect(outcome4.querySelector("del")?.textContent).toBe("studies.");

		const outcome1 = rowOf("Outcome 1");
		expect(outcome1.querySelector("ins")).toBeNull();
		expect(outcome1.querySelector(".line-through")?.textContent).toBe(
			outcomesReview.items[0].text,
		);

		expect(marksOf(rowOf("Outcome 2"))).toEqual([]);
		expect(container.textContent).not.toContain("Two outcomes need rewriting");
	});

	test("strips emphasis markers from the diff", () => {
		render(<Review view={readReview(referenceReview)} streaming={false} />);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Changes",
			}),
		);

		expect(rowOf("Shute (2008)").textContent).not.toContain("*");
	});

	test("shows revisions or the unrevised text in Revised", async () => {
		render(<Review view={readReview(outcomesReview)} streaming={false} />);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Revised",
			}),
		);

		expect(screen.queryByText("Outcome 1")).toBeNull();
		await waitFor(() =>
			expect(
				screen.getByText(/^Compare the strengths and limitations/),
			).toBeDefined(),
		);
		expect(screen.getByText(/^Design a mixed-methods study/)).toBeDefined();
		expect(
			screen.getAllByRole("button", {
				name: "Copy revision",
			}),
		).toHaveLength(3);
	});

	test("copies a revision as HTML with emphasis and as plain text", async () => {
		render(<Review view={readReview(referenceReview)} streaming={false} />);

		fireEvent.click(
			within(rowOf("Shute (2008)")).getByRole("button", {
				name: "Copy revision",
			}),
		);

		const { html, plain } = await lastCopy();
		expect(html).toContain("<em>Review of Educational Research</em>");
		expect(plain).toBe(
			"Shute, V. J. (2008). Focus on formative feedback. Review of Educational Research, 78(1), 153–189. https://doi.org/10.3102/0034654307313795",
		);
	});

	test("copies all revisions joined by blank lines", async () => {
		render(<Review view={readReview(referenceReview)} streaming={false} />);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Revised",
			}),
		);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Copy all",
			}),
		);

		const { html, plain } = await lastCopy();
		const revisions = referenceReview.items.map(
			(item) => ("revised" in item ? item.revised : item.text) as string,
		);
		expect(plain).toBe(revisions.join("\n\n").replaceAll("*", ""));
		expect(html.match(/<p>/g)).toHaveLength(4);
		expect(html).toContain("<em>Frontiers in Psychology</em>");
	});

	test("shows the pending icon while findings have not arrived", () => {
		const { container } = render(
			<Review
				view={readReview({
					title: "Check",
					items: [
						{
							label: "Streaming",
							text: "Some text",
						},
					],
				})}
				streaming
			/>,
		);

		expect(container.querySelector('[data-status="pending"]')).not.toBeNull();
	});

	test("shows skeletons until title and items arrive", () => {
		const { container } = render(<Review view={readReview({})} streaming />);

		expect(
			container.querySelectorAll('[data-slot="skeleton"]').length,
		).toBeGreaterThan(1);
	});

	test.each<
		[
			string,
			unknown,
		]
	>([
		[
			"empty input",
			{},
		],
		[
			"title only",
			{
				title: "APA",
			},
		],
		[
			"an item without findings",
			{
				title: "APA",
				items: [
					{
						label: "Hattie",
						text: "Hattie, J. and",
					},
				],
			},
		],
		[
			"a truncated excerpt and severity",
			{
				items: [
					{
						label: "Hattie",
						text: "Hattie, J. and Timperley, H.",
						findings: [
							{
								label: "Authors",
								severity: "err" as never,
								excerpt: "Hattie, J. a",
							},
						],
					},
				],
			},
		],
		[
			"holes in arrays",
			{
				items: [
					undefined,
					{
						findings: [
							undefined,
						],
						revised: "*Half",
					},
				],
				general: [
					undefined,
				],
			},
		],
		[
			"lists that are not lists",
			{
				title: "APA",
				items: "not a list",
				general: {
					label: "Not a list",
				},
			},
		],
		[
			"fields of the wrong type",
			{
				title: {
					text: "APA",
				},
				summary: 7,
				items: [
					"a string item",
					null,
					{
						label: {
							nested: true,
						},
						text: [
							"Hattie",
						],
						revised: false,
						findings: [
							null,
							{
								severity: [
									"error",
								],
								note: 3,
								excerpt: {
									text: "Hattie",
								},
							},
						],
					},
				],
			},
		],
	])("renders %s without throwing", (_, input) => {
		for (const streaming of [
			true,
			false,
		]) {
			expect(() =>
				render(<Review view={readReview(input)} streaming={streaming} />),
			).not.toThrow();
			cleanup();
		}
	});
});
