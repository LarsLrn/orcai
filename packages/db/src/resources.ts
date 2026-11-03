import type { OrganizationId } from "@orcai/core";
import type { ResourceType } from "@orcai/schema";
import { and, eq, isNull, type SQLWrapper, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { asset } from "./schema/asset";
import { resourceScope } from "./schema/authz";
import { block } from "./schema/block";
import { bot } from "./schema/bot";

/** The table of each resource type. */
export const resourceTables = {
	bot,
	block,
	asset,
} satisfies Record<ResourceType, unknown>;

/** `resource_scope` or an alias of it. */
type Scope = {
	resourceType: AnyPgColumn;
	resourceId: AnyPgColumn;
	isPrimary: AnyPgColumn;
	endedAt: AnyPgColumn;
};

/** Whether the scope row is the active home of its resource. */
export const isHome = (scope: Scope = resourceScope) =>
	and(eq(scope.isPrimary, true), isNull(scope.endedAt));

/** Whether the scope row is the active home of the resource in `id`. */
export const homeScopeOf = (
	resourceType: ResourceType,
	id: SQLWrapper | string,
	scope: Scope = resourceScope,
) =>
	and(
		eq(scope.resourceType, resourceType),
		eq(scope.resourceId, id),
		isHome(scope),
	);

/** The organisation the resource in `id` is home to, as a subquery. */
export const homeOrganization = (
	resourceType: ResourceType,
	id: SQLWrapper | string,
) =>
	sql<OrganizationId | null>`(
		select ${resourceScope.organizationId} from ${resourceScope}
		where ${homeScopeOf(resourceType, id)}
		limit 1
	)`;
