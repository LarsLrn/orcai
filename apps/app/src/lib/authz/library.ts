import type { OrganizationId } from "@orcai/core";
import { dbSchema } from "@orcai/db";
import type { LibrarySource } from "@orcai/schema";
import type { ResourceType } from "@orcai/spice-db";
import { type AnyColumn, sql } from "drizzle-orm";

const sourceCondition = {
	all: sql``,
	own: sql` and ${dbSchema.resourceScope.isPrimary}`,
	installed: sql` and not ${dbSchema.resourceScope.isPrimary}`,
} satisfies Record<LibrarySource, unknown>;

/**
 * Whether the resource in `id` belongs to the organisation's library: it has
 * an active scope there, its home or an install from the catalogue. Lists,
 * pickers and find tools show only these; what a bot or repository contains
 * loads through it instead.
 */
export const inLibrary = (
	resourceType: ResourceType,
	id: AnyColumn,
	organizationId: OrganizationId | undefined,
	source: LibrarySource = "all",
) => {
	const scope = dbSchema.resourceScope;
	return organizationId
		? sql`exists (
			select 1 from ${scope}
			where ${scope.resourceType} = ${resourceType}
				and ${scope.resourceId} = ${id}
				and ${scope.organizationId} = ${organizationId}
				and ${scope.endedAt} is null${sourceCondition[source]}
		)`
		: sql`false`;
};
