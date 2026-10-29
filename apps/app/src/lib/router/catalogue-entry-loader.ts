import {
	blockIdSchema,
	botIdSchema,
	type CatalogueEntryRef,
	type CatalogueKind,
} from "@orcai/schema";
import type { QueryClient } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";
import { ensureOrganizationCapability } from "@/lib/authz/route-guards";
import { cataloguePaths } from "@/lib/navigation/catalogue-paths";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound } from "@/lib/router/not-found";

/** The entry as `catalogue.find`, `install` and `uninstall` name it. */
export const catalogueEntryRef = (
	kind: CatalogueKind,
	id: string,
): CatalogueEntryRef =>
	kind === "bot"
		? {
				resourceType: "bot",
				resourceId: botIdSchema.parse(id),
			}
		: {
				resourceType: "block",
				resourceId: blockIdSchema.parse(id),
			};

/** The entry behind a kind's path; an entry of another kind is not found there. */
export const loadCatalogueEntry = async ({
	queryClient,
	kind,
	id,
}: {
	queryClient: QueryClient;
	kind: CatalogueKind;
	id: string;
}) => {
	const found = await orNotFound(
		queryClient.query(
			orpc.catalogue.find.queryOptions({
				input: {
					entry: catalogueEntryRef(kind, id),
				},
			}),
		),
	);

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
	id: string;
	search: object;
}) => {
	await ensureOrganizationCapability({
		queryClient: params.queryClient,
		permission: "install_resource",
	});
	const entry = await loadCatalogueEntry(params);
	if (entry.data.state !== "added")
		throw redirect({
			to: cataloguePaths(params.kind).detail,
			params: {
				id: params.id,
			},
			search: params.search,
		});
	return entry;
};
