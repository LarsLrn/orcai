import { afterEach, describe, expect, mock, test } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { readChecklist } from "@/components/chat/gen-ui/checklist/read";
import {
	type ChecklistInput,
	checklistSchema,
} from "@/components/chat/gen-ui/checklist/schema";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	orpc: {},
}));

const { Checklist } = await import(
	"@/components/chat/gen-ui/checklist/checklist"
);
const { CitationsContext } = await import("@/components/ai-elements/cite");

afterEach(cleanup);

/** The answer's citations, as the server resolved them, by the page each names. */
const apaPages = {
	286: "kgol9ts",
	299: "k5m2x0q",
} as const;

const citations = Object.fromEntries(
	Object.entries(apaPages).map(([page, ref]) => [
		ref,
		{
			kind: "asset" as const,
			assetId: "9b2d4c6e-1f3a-4b5c-8d7e-0a1b2c3d4e5f",
			title: "APA Publication Manual, 7th ed.",
			page: Number(page),
		},
	]),
);

const apa = (page: keyof typeof apaPages, text: string) =>
	`<cite ref=${apaPages[page]}>${text}</cite>`;

const statusList = {
	title: "APA 7 check",
	description: "Four references and the list as a whole.",
	items: [
		{
			label: "Hattie & Timperley (2007)",
			status: "not_met",
			summary: "Authors, Title, DOI",
			quote:
				"Hattie, J. and Timperley, H. (2007). The Power of Feedback. Review of Educational Research, 77(1), 81-112. doi:10.3102/003465430298487",
			body: [
				`- **Authors**: Two authors are joined with "and"; APA uses a comma and an ampersand. ${apa(286, "§9.8")}`,
				`- **DOI**: Write the DOI as a URL. ${apa(299, "§9.34")}`,
			].join("\n"),
		},
		{
			label: "Black & Wiliam (1998)",
			status: "met",
			summary: "No changes needed",
			quote:
				"Black, P., & Wiliam, D. (1998). Assessment and classroom learning.",
			body: "This entry follows APA 7.",
		},
		{
			label: "Shute (2008)",
			status: "partial",
			summary: "Source",
			body: "The page range needs an en dash (153–189).",
		},
		{
			label: "Reference list order",
			status: "n_a",
		},
	],
} satisfies ChecklistInput;

const plainList = {
	title: "Fixing the common errors",
	items: [
		{
			label: "Author lists",
			summary: "Surname, initials; ampersand before the last author",
			body: `Invert every author's name and give initials only. ${apa(286, "§9.8")}`,
		},
		{
			label: "DOIs",
			summary: "Always as https://doi.org/…",
		},
	],
} satisfies ChecklistInput;

const rowOf = (label: string) => {
	const row = screen.getByText(label).closest("li");
	if (!row) {
		throw new Error(`No row for ${label}`);
	}
	return row;
};

const triggerOf = (label: string) => {
	const trigger = rowOf(label).querySelector<HTMLElement>(
		'[data-slot="collapsible-trigger"]',
	);
	if (!trigger) {
		throw new Error(`No trigger for ${label}`);
	}
	return trigger;
};

describe("checklistSchema", () => {
	test("accepts status and plain lists", () => {
		expect(checklistSchema.safeParse(statusList).success).toBe(true);
		expect(checklistSchema.safeParse(plainList).success).toBe(true);
	});

	test("rejects input without items", () => {
		expect(
			checklistSchema.safeParse({
				title: "No items",
			}).success,
		).toBe(false);
	});
});

describe("Checklist", () => {
	test("renders the header with title, description and tally", () => {
		const { container } = render(
			<Checklist view={readChecklist(statusList)} streaming={false} />,
		);

		expect(
			screen.getByRole("heading", {
				name: "APA 7 check",
			}),
		).toBeDefined();
		expect(
			screen.getByText("Four references and the list as a whole."),
		).toBeDefined();
		const header = container.querySelector("h3")?.parentElement
			?.parentElement as HTMLElement;
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
				"1",
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

	test("renders rows with icons, summaries and non-met status labels", () => {
		render(<Checklist view={readChecklist(statusList)} streaming={false} />);

		const hattie = within(rowOf("Hattie & Timperley (2007)"));
		expect(
			hattie.getByRole("img", {
				name: "Not met",
			}),
		).toBeDefined();
		expect(hattie.getByText("Authors, Title, DOI")).toBeDefined();
		expect(hattie.getByText("Not met")).toBeDefined();

		const black = within(rowOf("Black & Wiliam (1998)"));
		expect(
			black.getByRole("img", {
				name: "Met",
			}),
		).toBeDefined();
		expect(black.queryByText("Met")).toBeNull();

		expect(within(rowOf("Shute (2008)")).getByText("Partly met")).toBeDefined();
		const order = within(rowOf("Reference list order"));
		expect(
			order.getByRole("img", {
				name: "Not checkable",
			}),
		).toBeDefined();
		expect(order.getByText("Not checkable")).toBeDefined();
	});

	test("expands a row to the quote above the body", async () => {
		render(
			<CitationsContext value={citations}>
				<Checklist view={readChecklist(statusList)} streaming={false} />
			</CitationsContext>,
		);

		const trigger = triggerOf("Hattie & Timperley (2007)");
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");

		const row = rowOf("Hattie & Timperley (2007)");
		await waitFor(() =>
			expect(
				within(row).getByTitle("APA Publication Manual, 7th ed. · p. 286"),
			).toBeDefined(),
		);
		const quote = within(row).getByText(/^Hattie, J\. and Timperley, H\./);
		expect(quote.tagName).toBe("BLOCKQUOTE");
		const body = within(row).getByText(/Two authors are joined/);
		expect(
			quote.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	test("opens several rows at once", () => {
		render(<Checklist view={readChecklist(statusList)} streaming={false} />);

		fireEvent.click(triggerOf("Hattie & Timperley (2007)"));
		fireEvent.click(triggerOf("Shute (2008)"));

		expect(
			triggerOf("Hattie & Timperley (2007)").getAttribute("aria-expanded"),
		).toBe("true");
		expect(triggerOf("Shute (2008)").getAttribute("aria-expanded")).toBe(
			"true",
		);
	});

	test("disables rows without body or quote", () => {
		render(<Checklist view={readChecklist(statusList)} streaming={false} />);

		const bare = triggerOf("Reference list order");
		expect(bare.hasAttribute("disabled")).toBe(true);
		fireEvent.click(bare);
		expect(bare.getAttribute("aria-expanded")).toBe("false");
		expect(triggerOf("Shute (2008)").hasAttribute("disabled")).toBe(false);
	});

	test("renders a plain accordion without statuses", () => {
		const { container } = render(
			<Checklist view={readChecklist(plainList)} streaming={false} />,
		);

		expect(screen.getByText("Fixing the common errors")).toBeDefined();
		expect(screen.queryAllByRole("img")).toEqual([]);
		expect(container.querySelector("[data-status]")).toBeNull();
		expect(triggerOf("Author lists").hasAttribute("disabled")).toBe(false);
		expect(triggerOf("DOIs").hasAttribute("disabled")).toBe(true);
	});

	test("renders no header without title, description or statuses", () => {
		const { container } = render(
			<Checklist
				view={readChecklist({
					items: [
						{
							label: "Only a row",
						},
					],
				})}
				streaming={false}
			/>,
		);

		expect(container.querySelector(".border-b")).toBeNull();
	});

	const missingStatus = {
		items: [
			{
				label: "Checked",
				status: "met",
			},
			{
				label: "Not yet",
			},
		],
	};

	test("shows the pending icon only while streaming", () => {
		const { container, rerender } = render(
			<Checklist view={readChecklist(missingStatus)} streaming />,
		);
		expect(
			rowOf("Not yet").querySelector('[data-status="pending"]'),
		).not.toBeNull();

		rerender(
			<Checklist view={readChecklist(missingStatus)} streaming={false} />,
		);
		expect(container.querySelector('[data-status="pending"]')).toBeNull();
		expect(within(rowOf("Not yet")).queryByRole("img")).toBeNull();
	});

	test("treats a status cut off mid-stream as pending", () => {
		// Streamed JSON can end inside a string, so the value is not yet a status.
		const cutOff = {
			items: [
				{
					label: "Checked",
					status: "met",
				},
				{
					label: "Cut off",
					status: "not_",
				},
			],
		};

		render(<Checklist view={readChecklist(cutOff)} streaming />);

		expect(
			rowOf("Cut off").querySelector('[data-status="pending"]'),
		).not.toBeNull();
		expect(within(rowOf("Cut off")).queryByRole("img")).toBeNull();
	});

	test("shows skeleton rows while items are empty and streaming", () => {
		const { container } = render(
			<Checklist
				view={readChecklist({
					title: "APA 7 check",
				})}
				streaming
			/>,
		);

		expect(
			container.querySelectorAll('[data-slot="skeleton"]').length,
		).toBeGreaterThan(0);
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
			"half a label",
			{
				items: [
					{
						label: "Hattie & Tim",
					},
				],
			},
		],
		[
			"items without status",
			{
				items: [
					{
						label: "One",
						status: "met",
					},
					{
						summary: "No label yet",
					},
				],
			},
		],
		[
			"undefined items",
			{
				items: [
					undefined,
					{
						label: "After a hole",
					},
				],
			},
		],
		[
			"items that are not a list",
			{
				title: "APA",
				items: "not a list",
			},
		],
		[
			"fields of the wrong type",
			{
				title: {
					text: "APA",
				},
				description: 7,
				items: [
					"a string item",
					null,
					{
						label: {
							nested: true,
						},
						status: [
							"met",
						],
						summary: 3,
						body: {
							markdown: "x",
						},
						quote: false,
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
				render(<Checklist view={readChecklist(input)} streaming={streaming} />),
			).not.toThrow();
			cleanup();
		}
	});
});
