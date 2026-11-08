import {
	blockIdSchema,
	botIdSchema,
	type CatalogueEntryRef,
	type CatalogueKind,
	catalogueKindSchema,
} from "@orcai/schema";
import type { QueryClient } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";
import { ensureOrganizationCapability } from "@/lib/authz/route-guards";
import { catalogueEntryQuery } from "@/lib/catalogue/catalogue-queries";
import { orNotFound, parseParam } from "@/lib/router/not-found";

const SLUGS = {
	bot: "bots",
	behaviour: "behaviours",
	repository: "repositories",
} as const satisfies Record<CatalogueKind, string>;

/** The `$kind` segment: a kind's plural slug in the path, the kind in params; any other slug is not found. */
export const catalogueKindParams = {
	parse: ({ kind: slug }: { kind: string }) => {
		const kind = catalogueKindSchema.options.find(
			(candidate) => SLUGS[candidate] === slug,
		);
		if (!kind) throw notFound();
		return {
			kind,
		};
	},
	stringify: ({ kind }: { kind: CatalogueKind }) => ({
		kind: SLUGS[kind],
	}),
};

/** The entry a kind's path names, as `catalogue.find`, `add` and `remove` take it; an id that does not parse is not found. */
export const catalogueEntryRef = (
	kind: CatalogueKind,
	id: string,
): CatalogueEntryRef =>
	kind === "bot"
		? {
				resourceType: "bot",
				resourceId: parseParam(botIdSchema, id),
			}
		: {
				resourceType: "block",
				resourceId: parseParam(blockIdSchema, id),
			};

/** The entry behind a kind's path; an entry of another kind is not found there. */
export const loadCatalogueEntry = async ({
	queryClient,
	kind,
	entry,
}: {
	queryClient: QueryClient;
	kind: CatalogueKind;
	entry: CatalogueEntryRef;
}) => {
	const found = await orNotFound(queryClient.query(catalogueEntryQuery(entry)));

	if (found.data.kind !== kind) {
		throw notFound();
	}

	return found;
};

/**
 * The entry the wizard sets up: only for admins and managers, and only once
 * the organisation added it; anything else shows the entry's page.
 */
export const loadAddedCatalogueEntry = async (params: {
	queryClient: QueryClient;
	kind: CatalogueKind;
	entry: CatalogueEntryRef;
	search: object;
}) => {
	await ensureOrganizationCapability({
		queryClient: params.queryClient,
		permission: "add_from_catalogue",
	});
	const found = await loadCatalogueEntry(params);
	if (found.data.state !== "added")
		throw redirect({
			to: "/app/catalogue/$kind/$id",
			params: {
				kind: params.kind,
				id: params.entry.resourceId,
			},
			search: params.search,
		});
	return found;
};
