import {
	type CatalogueCountsInput,
	type CatalogueKind,
	type HomeOrganization,
	type ListCatalogueInput,
	organizationIdSchema,
} from "@orcai/schema";
import { z } from "zod/v4";
import {
	browseSearchDefaults,
	browseSearchSchema,
	type FilterDefinitions,
	filterInput,
	multiFilter,
	singleFilter,
	toggleFilter,
} from "@/lib/browse/browse-search";
import { m } from "@/paraglide/messages";

/**
 * The catalogue's filters per view; Overview's apply while searching. The
 * organisations to pick from are the ones with entries.
 */
export const catalogueFilters = (
	organizations: readonly HomeOrganization[] = [],
) => {
	const organizationIds = multiFilter({
		label: m.catalogue_filter_organisation_label,
		value: organizationIdSchema,
		options: organizations.map((organization) => ({
			value: organization.id,
			label: () => organization.name,
		})),
		toInput: (values) => ({
			organizationIds: values,
		}),
	});
	const hideAdded = toggleFilter({
		label: m.catalogue_filter_status_label,
		optionLabel: m.catalogue_filter_hide_added,
		toInput: (on) => ({
			hideAdded: on,
		}),
	});
	return {
		overview: {
			organizationIds,
			hideAdded,
		},
		bot: {
			model: singleFilter({
				label: m.catalogue_filter_model_label,
				options: [
					{
						value: "any",
						label: m.catalogue_filter_model_any,
					},
					{
						value: "none",
						label: m.catalogue_filter_model_none,
					},
					{
						value: "recommended",
						label: m.catalogue_filter_model_recommended,
					},
					{
						value: "required",
						label: m.catalogue_filter_model_required,
					},
				],
				defaultValue: "any",
				toInput: (value) => ({
					model: value,
				}),
			}),
			organizationIds,
			hideAdded,
		},
		behaviour: {
			organizationIds,
			hideAdded,
		},
		repository: {
			organizationIds,
			hideAdded,
		},
	} satisfies Record<"overview" | CatalogueKind, FilterDefinitions>;
};

type CatalogueFilters = ReturnType<typeof catalogueFilters>;

export type CatalogueView = keyof CatalogueFilters;

const definitions = catalogueFilters();

/** Each view's search params: the browse params and its filters. */
export const catalogueSearchSchemas = {
	overview: browseSearchSchema(definitions.overview),
	bot: browseSearchSchema(definitions.bot),
	behaviour: browseSearchSchema(definitions.behaviour),
	repository: browseSearchSchema(definitions.repository),
};

export const catalogueSearchDefaults = {
	overview: browseSearchDefaults(definitions.overview),
	bot: browseSearchDefaults(definitions.bot),
	behaviour: browseSearchDefaults(definitions.behaviour),
	repository: browseSearchDefaults(definitions.repository),
};

export type CatalogueSearch<V extends CatalogueView> = z.output<
	(typeof catalogueSearchSchemas)[V]
>;

/** The view an entry's page was opened from, so its return links restore it. */
export const catalogueOriginSchema = z.object({
	view: z.enum([
		"overview",
		"bot",
		"behaviour",
		"repository",
	]),
	search: z.record(z.string(), z.unknown()),
});

export type CatalogueOrigin = z.infer<typeof catalogueOriginSchema>;

/** An entry's page and wizard carry their origin; a page opened directly has none. */
export const catalogueEntrySearchSchema = z.object({
	from: catalogueOriginSchema.optional().catch(undefined),
});

/** What a view lists for its search params: the input of `catalogue.list`. */
export const catalogueListInput = (
	view: CatalogueView,
	search: CatalogueSearch<CatalogueView>,
): ListCatalogueInput => ({
	pageIndex: search.pageIndex,
	pageSize: search.pageSize,
	search: search.query || undefined,
	sort: search.sort,
	model: "any",
	organizationIds: [],
	hideAdded: false,
	...(filterInput(
		definitions[view] as FilterDefinitions,
		search as never,
	) as Partial<ListCatalogueInput>),
	kind: view === "overview" ? undefined : view,
});

/** The rail's counts follow the search, not a view's filters. */
export const catalogueCountsInput = (search: {
	query: string;
}): CatalogueCountsInput => ({
	search: search.query || undefined,
});
