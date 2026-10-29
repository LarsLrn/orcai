import { describe, expect, test } from "bun:test";
import { activeFilterCount } from "@/lib/browse/browse-search";
import {
	type LibraryView,
	libraryCountsInput,
	libraryFilters,
	libraryListInput,
	librarySearchDefaults,
	librarySearchSchema,
} from "@/lib/library/library-filters";

const parse = <V extends LibraryView>(view: V, search: object) =>
	librarySearchSchema(libraryFilters[view]).parse(search);

const views = Object.keys(libraryFilters) as LibraryView[];

describe("library filters", () => {
	test.each(views)(
		"an empty URL is %s's defaults, which links strip",
		(view) => {
			expect(parse(view, {})).toEqual(
				librarySearchDefaults(libraryFilters[view]),
			);
		},
	);

	test.each(views)("%s replaces unknown values by defaults", (view) => {
		expect(
			parse(view, {
				scope: "everyone",
				sort: "oldest",
				status: "archived",
				origin: "email",
				processing: "stuck",
				favourite: "maybe",
			}),
		).toEqual(librarySearchDefaults(libraryFilters[view]));
	});

	test("bots map status, favourites, Mine, search and sort onto bot.list", () => {
		expect(
			libraryListInput.bot(
				parse("bot", {
					scope: "edit",
					query: "tutor",
					sort: "name",
					status: "draft",
					source: "own",
					favourite: true,
					pageIndex: 2,
					pageSize: 50,
				}),
			),
		).toEqual({
			pageIndex: 2,
			pageSize: 50,
			search: "tutor",
			sort: "name",
			filters: {
				status: "draft",
				source: "own",
				favourite: true,
				scope: "edit",
			},
		});
		expect(libraryListInput.bot(parse("bot", {}))).toEqual({
			pageIndex: 0,
			pageSize: 20,
			search: undefined,
			sort: "newest",
			filters: {
				status: "all",
				source: "all",
				scope: "all",
			},
		});
	});

	test.each([
		[
			"behaviour",
			"template",
		],
		[
			"repository",
			"database",
		],
	] as const)("%s lists blocks of type %s", (view, type) => {
		expect(
			libraryListInput[view](
				parse(view, {
					status: "ready",
					query: "notes",
				}),
			),
		).toEqual({
			pageIndex: 0,
			pageSize: 20,
			sort: "newest",
			filters: {
				status: "ready",
				source: "all",
				type,
				scope: "all",
				search: "notes",
			},
		});
	});

	test("assets map origin and processing; any processing is no filter", () => {
		expect(libraryListInput.asset(parse("asset", {}))).toEqual({
			pageIndex: 0,
			pageSize: 20,
			sort: "newest",
			filters: {
				origin: "library",
				scope: "all",
				search: undefined,
			},
		});
		expect(
			libraryListInput.asset(
				parse("asset", {
					origin: "chat",
					processing: "failed",
				}),
			).filters,
		).toEqual({
			origin: "chat",
			processing: "failed",
			scope: "all",
			search: undefined,
		});
	});

	test("assets map the review toggle to the suggestions filter, off sends nothing", () => {
		expect(
			libraryListInput.asset(
				parse("asset", {
					review: "true",
				}),
			).filters,
		).toEqual({
			origin: "library",
			suggestions: true,
			scope: "all",
			search: undefined,
		});
		expect(
			libraryListInput.asset(
				parse("asset", {
					review: false,
				}),
			).filters,
		).not.toHaveProperty("suggestions");
		expect(
			libraryListInput.asset(
				parse("asset", {
					review: "maybe",
				}),
			).filters,
		).not.toHaveProperty("suggestions");
	});

	test("the overview searches every kind with the status and source filters", () => {
		expect(
			libraryListInput.overview(
				parse("overview", {
					query: "methods",
					status: "draft",
					source: "installed",
					scope: "edit",
				}),
			),
		).toEqual({
			pageIndex: 0,
			pageSize: 20,
			search: "methods",
			scope: "edit",
			sort: "newest",
			status: "draft",
			source: "installed",
		});
	});

	test("Filters (n) counts filters off their default, not scope, search or sort", () => {
		const bots = (search: object) =>
			activeFilterCount(libraryFilters.bot, parse("bot", search));
		expect(bots({})).toBe(0);
		expect(
			bots({
				scope: "edit",
				query: "x",
				sort: "name",
			}),
		).toBe(0);
		expect(
			bots({
				status: "draft",
				favourite: true,
			}),
		).toBe(2);
		expect(
			activeFilterCount(
				libraryFilters.asset,
				parse("asset", {
					origin: "chat",
				}),
			),
		).toBe(1);
	});

	test("rail counts follow Mine and the search only", () => {
		expect(
			libraryCountsInput(
				parse("asset", {
					scope: "edit",
					query: "",
					origin: "chat",
				}),
			),
		).toEqual({
			scope: "edit",
			search: undefined,
		});
	});
});
