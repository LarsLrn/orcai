import type { OrganizationId, UserId } from "@orcai/core";
import { dbSchema } from "@orcai/db";
import type {
	LibraryScope,
	LibrarySource,
	PublicationStatusFilter,
} from "@orcai/schema";
import { lookupEntitiesByPermission } from "@orcai/spice-db";
import { and, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { readableNow } from "@/lib/authz/content-access";
import { inLibrary } from "@/lib/authz/library";
import { usableHere } from "@/lib/authz/organization-use";

export type LibraryResource = "bot" | "block" | "asset";

type Permission = "read" | "edit" | "use";

export type Reader = {
	userId: UserId;
	organizationId: OrganizationId | undefined;
	zedToken: string | undefined;
};

const lookup = (
	reader: Reader,
	resource: LibraryResource,
	permission: Permission,
) =>
	lookupEntitiesByPermission({
		userId: reader.userId,
		zedToken: reader.zedToken,
		entityType: resource,
		permission,
	});

/**
 * What the reader may list from the active organisation's library, as SQL
 * conditions per resource type. Each SpiceDB enumeration runs at most once,
 * so the lists and counts of one request share them.
 *
 * Published resources need read and drafts need edit; scope "edit" asks for
 * edit on both. Assets have no status. `source` tells what the organisation
 * made from what it added from the catalogue.
 */
export const libraryAccess = (reader: Reader) =>
	Effect.gen(function* () {
		const lookups = new Map<string, ReturnType<typeof lookup>>();
		const ids = (resource: LibraryResource, permission: Permission) =>
			Effect.gen(function* () {
				const key = `${resource}:${permission}`;
				const known = lookups.get(key);
				if (known) return yield* known;
				const cached = yield* Effect.cached(
					lookup(reader, resource, permission),
				);
				lookups.set(key, cached);
				return yield* cached;
			});

		const condition = (
			resource: LibraryResource,
			{
				scope = "all",
				status = "ready",
				source = "all",
			}: {
				scope?: LibraryScope;
				status?: PublicationStatusFilter;
				source?: LibrarySource;
			},
		) =>
			Effect.gen(function* () {
				const table = dbSchema[resource];
				const held = (permission: Permission) =>
					Effect.map(ids(resource, permission), (allowed) =>
						inArray(table.id, allowed),
					);
				const shared = [
					inLibrary(resource, table.id, reader.organizationId, source),
					readableNow(resource, table.id, reader.userId),
				];
				if (resource === "asset" || scope === "edit") {
					const allowed = yield* held(scope === "edit" ? "edit" : "read");
					const statusCondition =
						resource === "asset" || status === "all"
							? undefined
							: eq(dbSchema[resource].status, status);
					return and(allowed, statusCondition, ...shared) as SQL;
				}
				const statusColumn = dbSchema[resource].status;
				const published = Effect.map(held("read"), (allowed) =>
					and(eq(statusColumn, "ready"), allowed),
				);
				const drafts = Effect.map(held("edit"), (allowed) =>
					and(eq(statusColumn, "draft"), allowed),
				);
				const visible =
					status === "ready"
						? yield* published
						: status === "draft"
							? yield* drafts
							: or(yield* published, yield* drafts);
				return and(visible, ...shared) as SQL;
			});

		/** The resources the reader may use in the active organisation, such as to start a chat. */
		const usable = (resource: LibraryResource) =>
			Effect.gen(function* () {
				const { organizationId } = reader;
				if (!organizationId) return sql`false`;
				const table = dbSchema[resource];
				return and(
					inArray(table.id, yield* ids(resource, "use")),
					usableHere({
						resourceType: resource,
						id: table.id,
						userId: reader.userId,
						organizationId,
					}),
				) as SQL;
			});

		return {
			condition,
			usable,
		};
	});

export type LibraryAccess = Effect.Success<ReturnType<typeof libraryAccess>>;
