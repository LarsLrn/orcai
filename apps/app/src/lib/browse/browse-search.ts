import { librarySortSchema } from "@orcai/schema";
import { z } from "zod/v4";
import {
	dataTableQuerySchema,
	paginationSearchShape,
} from "@/components/ui/data-table/data-table-search-params";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/pager";

/*
 * Declarative filters of a browsing surface. Each definition is one search
 * param, keyed by its name: the rail, the mobile drawer, the Filters (n)
 * count, the URL and the list input all derive from it.
 */

type FilterOption<V extends string> = {
	value: V;
	label: () => string;
};

/** One choice out of several, such as a status. */
export const singleFilter = <const V extends string, I>(definition: {
	label: () => string;
	options: readonly [
		FilterOption<V>,
		...FilterOption<V>[],
	];
	defaultValue: NoInfer<V>;
	toInput: (value: V) => I;
}) => ({
	type: "single" as const,
	...definition,
	schema: z
		.enum(
			definition.options.map((option) => option.value) as [
				V,
				...V[],
			],
		)
		.catch(definition.defaultValue)
		.default(definition.defaultValue),
});

/** A checkbox that narrows the list when on, such as only favourites. */
export const toggleFilter = <I>(definition: {
	label: () => string;
	optionLabel: () => string;
	toInput: (on: boolean) => I;
}) => ({
	type: "toggle" as const,
	...definition,
	defaultValue: false,
	schema: z.boolean().catch(false).default(false),
});

/** Any number of choices, such as organisations; none narrows nothing. */
export const multiFilter = <V extends string, I>({
	value,
	...definition
}: {
	label: () => string;
	/** One choice's value in the URL. */
	value: z.ZodType<V>;
	options: readonly FilterOption<V>[];
	toInput: (values: V[]) => I;
}) => ({
	type: "multi" as const,
	...definition,
	defaultValue: [] as V[],
	schema: z.array(value).catch([]).default([]),
});

export type FilterDefinition =
	| {
			type: "single";
			label: () => string;
			options: readonly FilterOption<string>[];
			defaultValue: string;
			schema: z.ZodType;
			toInput: (value: never) => object;
	  }
	| {
			type: "multi";
			label: () => string;
			options: readonly FilterOption<string>[];
			defaultValue: string[];
			schema: z.ZodType;
			toInput: (value: never) => object;
	  }
	| {
			type: "toggle";
			label: () => string;
			optionLabel: () => string;
			defaultValue: boolean;
			schema: z.ZodType;
			toInput: (value: never) => object;
	  };

export type FilterDefinitions = Record<string, FilterDefinition>;

export type FilterValues<D extends FilterDefinitions> = {
	[K in keyof D]: z.output<D[K]["schema"]>;
};

const mapDefinitions = <D extends FilterDefinitions, T>(
	definitions: D,
	map: (definition: D[keyof D], key: keyof D & string) => T,
) =>
	Object.fromEntries(
		Object.entries(definitions).map(([key, definition]) => [
			key,
			map(definition as D[keyof D], key),
		]),
	) as Record<keyof D, T>;

/** Search params every browsing view takes: paging, the search query and the sort. */
const browseShape = {
	...paginationSearchShape,
	query: dataTableQuerySchema.catch("").default(""),
	sort: librarySortSchema.catch("newest").default("newest"),
};

export const browseSearchSchema = <D extends FilterDefinitions>(filters: D) =>
	z.object({
		...browseShape,
		...(mapDefinitions(filters, (definition) => definition.schema) as {
			[K in keyof D]: D[K]["schema"];
		}),
	});

/** The search params at their defaults, which links strip. */
export const browseSearchDefaults = <D extends FilterDefinitions>(
	filters: D,
) => ({
	pageIndex: 0,
	pageSize: DEFAULT_PAGE_SIZE,
	query: "",
	sort: "newest" as const,
	...(mapDefinitions(filters, (definition) => definition.defaultValue) as {
		[K in keyof D]: D[K]["defaultValue"];
	}),
});

/** How many filters differ from their default: the n of "Filters (n)". */
export const activeFilterCount = <D extends FilterDefinitions>(
	filters: D,
	values: FilterValues<D>,
) =>
	Object.entries(filters).filter(([key, definition]) => {
		const value: unknown = values[key];
		return Array.isArray(value)
			? value.length > 0
			: value !== definition.defaultValue;
	}).length;

/** Every filter's input together; one filter's input may vary with its value. */
type FilterInputs<D extends FilterDefinitions> = {
	[K in keyof D]: (input: ReturnType<D[K]["toInput"]>) => void;
}[keyof D] extends (input: infer I) => void
	? I
	: never;

/** The list input the filters' values map onto. */
export const filterInput = <D extends FilterDefinitions>(
	filters: D,
	values: FilterValues<D>,
) =>
	Object.assign(
		{},
		...Object.entries(filters).map(([key, definition]) =>
			definition.toInput(values[key] as never),
		),
	) as FilterInputs<D>;
