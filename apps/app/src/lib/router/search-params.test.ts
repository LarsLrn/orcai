import { describe, expect, test } from "bun:test";
import { browseSearchSchema, toggleFilter } from "@/lib/browse/browse-search";
import { parseSearch, stringifySearch } from "./search-params";

describe("parseSearch", () => {
	test("keeps plain values as strings", () => {
		expect(parseSearch("?query=239827&flag=true&empty=&text=null")).toEqual({
			query: "239827",
			flag: "true",
			empty: "",
			text: "null",
		});
	});

	test("reads JSON strings, arrays and objects", () => {
		expect(
			parseSearch(
				`query=${encodeURIComponent('"2024"')}&sort=${encodeURIComponent('[{"id":"name","desc":true}]')}&from=${encodeURIComponent('{"view":"bot","search":{"pageIndex":2}}')}`,
			),
		).toEqual({
			query: "2024",
			sort: [
				{
					id: "name",
					desc: true,
				},
			],
			from: {
				view: "bot",
				search: {
					pageIndex: 2,
				},
			},
		});
	});

	test("keeps a value that only looks like JSON", () => {
		expect(parseSearch(`query=${encodeURIComponent("[draft")}`)).toEqual({
			query: "[draft",
		});
	});
});

describe("stringifySearch", () => {
	test("round-trips through parseSearch", () => {
		const search = {
			query: "239827",
			bracket: "[1]",
			quoted: '"x"',
			sort: [
				{
					id: "name",
					desc: false,
				},
			],
		};
		expect(parseSearch(stringifySearch(search))).toEqual(search);
	});

	test("writes plain strings, numbers and booleans as they are", () => {
		expect(
			stringifySearch({
				query: "2024",
				pageIndex: 2,
				hideAdded: true,
			}),
		).toBe("?query=2024&pageIndex=2&hideAdded=true");
	});
});

describe("a browse view's search over parsed values", () => {
	const schema = browseSearchSchema({
		favourite: toggleFilter({
			label: () => "",
			optionLabel: () => "",
			toInput: (on) => ({
				favourite: on,
			}),
		}),
	});

	test("keeps a digit-only query and coerces paging and toggles", () => {
		expect(
			schema.parse(
				parseSearch("query=239827&pageIndex=2&pageSize=40&favourite=true"),
			),
		).toEqual({
			query: "239827",
			pageIndex: 2,
			pageSize: 40,
			sort: "newest",
			favourite: true,
		});
	});

	test("reads toggles from navigation as from the address", () => {
		expect(
			schema.parse({
				favourite: true,
			}).favourite,
		).toBe(true);
		expect(schema.parse(parseSearch("favourite=false")).favourite).toBe(false);
		expect(schema.parse(parseSearch("favourite=maybe")).favourite).toBe(false);
	});
});
