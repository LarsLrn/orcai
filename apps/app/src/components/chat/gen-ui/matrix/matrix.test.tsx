import { afterEach, describe, expect, mock, test } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import type { DeepPartial } from "ai";
import { referenceMatrix } from "@/components/chat/gen-ui/matrix/fixtures";
import {
	type MatrixInput,
	matrixSchema,
} from "@/components/chat/gen-ui/matrix/schema";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	orpc: {},
}));

const { Matrix } = await import("@/components/chat/gen-ui/matrix/matrix");

afterEach(cleanup);

const rowOf = (label: string) => {
	const row = screen.getByText(label).closest("tr");
	if (!row) {
		throw new Error(`No row for ${label}`);
	}
	return row;
};

const cellNames = (row: HTMLElement) =>
	[
		...row.querySelectorAll("td"),
	]
		.slice(1, -1)
		.map(
			(cell) =>
				cell.querySelector("[role=img]")?.getAttribute("aria-label") ??
				cell.querySelector("[data-status]")?.getAttribute("data-status") ??
				null,
		);

const notesButton = (label: string) => within(rowOf(label)).getByRole("button");

describe("matrixSchema", () => {
	test("accepts a status matrix", () => {
		expect(matrixSchema.safeParse(referenceMatrix).success).toBe(true);
	});

	test("rejects a cell without status", () => {
		expect(
			matrixSchema.safeParse({
				columns: [],
				rows: [
					{
						label: "One",
						cells: {
							a: {
								note: "No status",
							},
						},
					},
				],
			}).success,
		).toBe(false);
	});
});

describe("Matrix", () => {
	test("renders column headers in order and a tally over all cells", () => {
		const { container } = render(
			<Matrix input={referenceMatrix} streaming={false} />,
		);

		expect(
			screen.getAllByRole("columnheader").map((header) => header.textContent),
		).toEqual([
			"",
			"Authors",
			"Title",
			"DOI",
			"",
		]);
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
				"2",
			],
			[
				"Met",
				"4",
			],
		]);
	});

	test("names cell icons by status, with the label as tooltip", () => {
		render(<Matrix input={referenceMatrix} streaming={false} />);

		expect(cellNames(rowOf("Shute (2008)"))).toEqual([
			"Met",
			"Not checkable",
			"Partly met",
		]);
		expect(rowOf("Shute (2008)").querySelectorAll("td")[1].title).toBe("Met");
	});

	test("offers notes only on rows with notes on cells that are not met", () => {
		render(<Matrix input={referenceMatrix} streaming={false} />);

		expect(notesButton("Hattie & Timperley (2007)").textContent).toBe(
			"3 notes",
		);
		expect(notesButton("Shute (2008)").textContent).toBe("2 notes");
		expect(
			within(rowOf("Black & Wiliam (1998)")).queryByRole("button"),
		).toBeNull();
		expect(screen.queryByText("Inverted names with initials.")).toBeNull();
	});

	test("expands several rows at once, by button or by row", () => {
		render(<Matrix input={referenceMatrix} streaming={false} />);

		const hattie = notesButton("Hattie & Timperley (2007)");
		expect(hattie.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(hattie);
		fireEvent.click(rowOf("Shute (2008)"));

		expect(hattie.getAttribute("aria-expanded")).toBe("true");
		expect(notesButton("Shute (2008)").getAttribute("aria-expanded")).toBe(
			"true",
		);
		const notes = rowOf("Hattie & Timperley (2007)").nextElementSibling;
		expect(
			[
				...(notes?.querySelectorAll("li") ?? []),
			].map((note) => [
				note.querySelector("[role=img]")?.getAttribute("aria-label"),
				note.querySelector(".font-medium")?.textContent,
			]),
		).toEqual([
			[
				"Not met",
				"Authors",
			],
			[
				"Not met",
				"Title",
			],
			[
				"Partly met",
				"DOI",
			],
		]);
		expect(
			screen.getByText("The title is cut off in the paste."),
		).toBeDefined();

		fireEvent.click(hattie);
		expect(hattie.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByText("Use sentence case.")).toBeNull();
	});

	test("ignores unknown cell keys and leaves missing cells empty", () => {
		render(
			<Matrix
				input={{
					columns: referenceMatrix.columns,
					rows: [
						{
							label: "Odd row",
							cells: {
								authors: {
									status: "met",
								},
								extra: {
									status: "not_met",
									note: "Not a column.",
								},
							},
						},
					],
				}}
				streaming={false}
			/>,
		);

		expect(cellNames(rowOf("Odd row"))).toEqual([
			"Met",
			null,
			null,
		]);
		expect(within(rowOf("Odd row")).queryByRole("button")).toBeNull();
		expect(
			screen.queryAllByRole("img", {
				name: "Not met",
			}),
		).toEqual([]);
	});

	test("shows pending icons for cells still streaming", () => {
		render(
			<Matrix
				input={{
					columns: referenceMatrix.columns,
					rows: [
						{
							label: "Partial row",
							cells: {
								authors: {
									status: "not_" as never,
								},
							},
						},
					],
				}}
				streaming
			/>,
		);

		expect(cellNames(rowOf("Partial row"))).toEqual([
			"pending",
			"pending",
			"pending",
		]);
	});

	test("shows a skeleton until the columns arrive", () => {
		const { container } = render(
			<Matrix
				input={{
					title: "APA",
				}}
				streaming
			/>,
		);

		expect(
			container.querySelectorAll('[data-slot="skeleton"]').length,
		).toBeGreaterThan(0);
		expect(screen.queryByRole("table")).toBeNull();
	});

	test.each<
		[
			string,
			DeepPartial<MatrixInput>,
		]
	>([
		[
			"empty input",
			{},
		],
		[
			"columns without keys",
			{
				columns: [
					{
						label: "Auth",
					},
					undefined,
				],
			},
		],
		[
			"partial rows",
			{
				columns: referenceMatrix.columns,
				rows: [
					undefined,
					{
						label: "Hat",
					},
					{
						cells: {
							authors: undefined,
							title: {
								note: "Half",
							},
						},
					},
				],
			},
		],
		[
			"lists that are not lists",
			{
				columns: "not a list",
				rows: {
					label: "Not a list",
				},
			} as unknown as DeepPartial<MatrixInput>,
		],
		[
			"fields of the wrong type",
			{
				title: 7,
				columns: [
					null,
					{
						key: [
							"authors",
						],
						label: "Authors",
					},
					{
						key: "title",
						label: {
							text: "Title",
						},
					},
				],
				rows: [
					"a string row",
					{
						label: false,
						cells: [
							"not a record",
						],
					},
					{
						label: "Hattie",
						cells: {
							title: {
								status: [
									"met",
								],
								note: {
									text: "x",
								},
							},
						},
					},
				],
			} as unknown as DeepPartial<MatrixInput>,
		],
	])("renders %s without throwing", (_, input) => {
		for (const streaming of [
			true,
			false,
		]) {
			expect(() =>
				render(<Matrix input={input} streaming={streaming} />),
			).not.toThrow();
			cleanup();
		}
	});
});
