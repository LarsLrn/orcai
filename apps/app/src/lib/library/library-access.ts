import type { OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema, idIn } from "@orcai/db";
import type {
	LibraryOrigin,
	LibraryScope,
	PublicationStatusFilter,
} from "@orcai/schema";
import {
	type EntityIdFor,
	permittedEntityIds,
	type ReadRevision,
} from "@orcai/spice-db";
import { and, eq, isNull, or, type SQL, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { readableNow } from "@/lib/authz/content-access";
import { usableHere } from "@/lib/authz/organization-use";
import { inLibrary } from "@/lib/library/in-library";

export type LibraryResource = "bot" | "block" | "asset";

type Permission = "read" | "edit" | "use";

export type Reader = {
	userId: UserId;
	organizationId: OrganizationId | undefined;
	zedToken: ReadRevision | undefined;
};

/**
 * What the reader may list from the active organisation's library, as SQL
 * conditions per resource type. SpiceDB checks only the organisation's items
 * that committed state lets the reader read, or use, so the cost follows the
 * organisation's library and not everything the reader can reach. Each check
 * runs at most once, so the lists and counts of one request share them. The
 * conditions check committed state again, so access ended meanwhile is gone.
 *
 * Published resources need read and drafts need edit; scope "edit" asks for
 * edit on both. Assets have no status. `origin` tells what the organisation
 * made from what it added from the catalogue.
 */
export const libraryAccess = (reader: Reader) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { userId, organizationId, zedToken } = reader;
		const scope = dbSchema.resourceScope;

		const inOrganization = (
			resource: LibraryResource,
			committed: (id: typeof scope.resourceId) => SQL,
		) =>
			Effect.gen(function* () {
				if (!organizationId) return [];
				const rows = yield* db
					.select({
						id: scope.resourceId,
					})
					.from(scope)
					.where(
						and(
							eq(scope.organizationId, organizationId),
							eq(scope.resourceType, resource),
							isNull(scope.endedAt),
							committed(scope.resourceId),
						),
					);
				return rows.map((row) => row.id as EntityIdFor<LibraryResource>);
			});

		const checked = <E, R>(
			resource: LibraryResource,
			permission: Permission,
			candidates: Effect.Effect<EntityIdFor<LibraryResource>[], E, R>,
		) =>
			Effect.cached(
				candidates.pipe(
					Effect.flatMap((entityIds) =>
						permittedEntityIds({
							entityIds,
							entityType: resource,
							permission,
							userId,
							zedToken,
						}),
					),
					Effect.map((permitted) => [
						...permitted,
					]),
				),
			);

		const permissionsOf = (resource: LibraryResource) =>
			Effect.gen(function* () {
				const readable = yield* Effect.cached(
					inOrganization(resource, (id) => readableNow(resource, id, userId)),
				);
				const usable = inOrganization(resource, (id) =>
					organizationId
						? usableHere({
								resourceType: resource,
								id,
								userId,
								organizationId,
							})
						: sql`false`,
				);
				return {
					read: yield* checked(resource, "read", readable),
					edit: yield* checked(resource, "edit", readable),
					use: yield* checked(resource, "use", usable),
				} satisfies Record<Permission, unknown>;
			});

		const permitted = {
			bot: yield* permissionsOf("bot"),
			block: yield* permissionsOf("block"),
			asset: yield* permissionsOf("asset"),
		} satisfies Record<LibraryResource, unknown>;

		const condition = (
			resource: LibraryResource,
			{
				scope = "all",
				status = "ready",
				origin = "all",
			}: {
				scope?: LibraryScope;
				status?: PublicationStatusFilter;
				origin?: LibraryOrigin;
			},
		) =>
			Effect.gen(function* () {
				const table = dbSchema[resource];
				const held = (permission: Permission) =>
					Effect.map(permitted[resource][permission], (ids) =>
						idIn(table.id, ids),
					);
				const listed = and(
					inLibrary(resource, table.id, organizationId, origin),
					readableNow(resource, table.id, userId),
				);
				if (resource === "asset" || scope === "edit") {
					const allowed = yield* held(scope === "edit" ? "edit" : "read");
					const statusCondition =
						resource === "asset" || status === "all"
							? undefined
							: eq(dbSchema[resource].status, status);
					return and(allowed, statusCondition, listed) as SQL;
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
							: or(
									...(yield* Effect.all(
										[
											published,
											drafts,
										],
										{
											concurrency: "unbounded",
										},
									)),
								);
				return and(visible, listed) as SQL;
			});

		/** The library's resources the reader may read, drafts included. */
		const readable = (resource: LibraryResource) =>
			Effect.map(
				permitted[resource].read,
				(ids) =>
					and(
						idIn(dbSchema[resource].id, ids),
						inLibrary(resource, dbSchema[resource].id, organizationId),
						readableNow(resource, dbSchema[resource].id, userId),
					) as SQL,
			);

		/** The resources the reader may use in the active organisation, such as to start a chat. */
		const usable = (resource: LibraryResource) =>
			Effect.map(permitted[resource].use, (ids) =>
				organizationId
					? (and(
							idIn(dbSchema[resource].id, ids),
							usableHere({
								resourceType: resource,
								id: dbSchema[resource].id,
								userId,
								organizationId,
							}),
						) as SQL)
					: sql`false`,
			);

		return {
			condition,
			readable,
			usable,
		};
	});

export type LibraryAccess = Effect.Success<ReturnType<typeof libraryAccess>>;
