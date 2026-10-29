import { describe, expect, test } from "bun:test";
import { organizationIdSchema } from "@orcai/schema";
import { activeFilterCount } from "@/lib/browse/browse-search";
import {
	type CatalogueView,
	catalogueCountsInput,
	catalogueFilters,
	catalogueListInput,
	catalogueSearchDefaults,
	catalogueSearchSchemas,
} from "@/lib/catalogue/catalogue-filters";

const ORGANIZATION = organizationIdSchema.parse(
	"6f1c3d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
);

const parse = <V extends CatalogueView>(view: V, search: object) =>
	catalogueSearchSchemas[view].parse(search);

const views = Object.keys(catalogueSearchSchemas) as CatalogueView[];

describe("catalogue filters", () => {
	test.each(views)(
		"an empty URL is %s's defaults, which links strip",
		(view) => {
			expect(parse(view, {})).toEqual(catalogueSearchDefaults[view]);
		},
	);

	test.each(views)("%s replaces unknown values by defaults", (view) => {
		expect(
			parse(view, {
				sort: "oldest",
				model: "maybe",
				organizationIds: [
					"not-an-id",
				],
				hideAdded: "sometimes",
			}),
		).toEqual(catalogueSearchDefaults[view]);
	});

	test("bots map model, organisations, hide added, search and sort onto catalogue.list", () => {
		expect(
			catalogueListInput(
				"bot",
				parse("bot", {
					query: "tutor",
					sort: "name",
					model: "required",
					organizationIds: [
						ORGANIZATION,
					],
					hideAdded: true,
					pageIndex: 2,
					pageSize: 50,
				}),
			),
		).toEqual({
			pageIndex: 2,
			pageSize: 50,
			search: "tutor",
			sort: "name",
			model: "required",
			organizationIds: [
				ORGANIZATION,
			],
			hideAdded: true,
			kind: "bot",
		});
	});

	test.each([
		"behaviour",
		"repository",
	] as const)("%s lists its kind and ignores a model", (view) => {
		expect(
			catalogueListInput(
				view,
				parse(view, {
					model: "required",
				}),
			),
		).toEqual({
			pageIndex: 0,
			pageSize: 20,
			search: undefined,
			sort: "newest",
			model: "any",
			organizationIds: [],
			hideAdded: false,
			kind: view,
		});
	});

	test("the overview searches every kind", () => {
		expect(
			catalogueListInput(
				"overview",
				parse("overview", {
					query: "apa",
					hideAdded: true,
				}),
			),
		).toMatchObject({
			search: "apa",
			hideAdded: true,
			kind: undefined,
		});
	});

	test("Filters (n) counts chosen organisations as one filter, not search or sort", () => {
		const filters = catalogueFilters().bot;
		const count = (search: object) =>
			activeFilterCount(filters, catalogueSearchSchemas.bot.parse(search));
		expect(
			count({
				query: "x",
				sort: "name",
			}),
		).toBe(0);
		expect(
			count({
				organizationIds: [
					ORGANIZATION,
				],
			}),
		).toBe(1);
		expect(
			count({
				organizationIds: [
					ORGANIZATION,
				],
				model: "none",
				hideAdded: true,
			}),
		).toBe(3);
	});

	test("the organisation filter offers the organisations with entries", () => {
		expect(
			catalogueFilters([
				{
					id: ORGANIZATION,
					name: "Writing Centre",
					logo: null,
				},
			]).overview.organizationIds.options.map((option) => [
				option.value,
				option.label(),
			]),
		).toEqual([
			[
				ORGANIZATION,
				"Writing Centre",
			],
		]);
	});

	test("rail counts follow the search only", () => {
		expect(
			catalogueCountsInput(
				parse("bot", {
					query: "",
					model: "none",
				}),
			),
		).toEqual({
			search: undefined,
		});
	});
});
