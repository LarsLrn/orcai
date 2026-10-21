import { v1 } from "@authzed/authzed-node";
import type { UserId } from "@orcai/core";
import * as Effect from "effect/Effect";
import { SpiceDbError } from "../errors";
import { SpiceDbService } from "../service";
import type { EntityIdFor } from "../types/entity-id";
import type { EntityType } from "../types/entity-type";
import type { PermissionFor } from "../types/permissions";
import {
	createConsistency,
	createResourceReference,
	createSubjectReference,
} from "../utils";

// SpiceDB's default cap on items in one bulk check.
const MAX_ITEMS_PER_REQUEST = 10_000;

/**
 * The permissions among `permissions` the user holds on each of `entityIds`,
 * in one round trip per 10,000 checks. Entities with none are absent. An item
 * SpiceDB could not evaluate fails the whole check instead of reading as a
 * denial.
 */
export const grantedPermissions = <
	Entity extends EntityType,
	Permission extends PermissionFor<Entity>,
>(params: {
	entityIds: readonly EntityIdFor<Entity>[];
	entityType: Entity;
	permissions: readonly Permission[];
	userId: UserId;
	zedToken?: string | null | undefined;
}) =>
	Effect.gen(function* () {
		const granted = new Map<EntityIdFor<Entity>, Set<Permission>>();
		const entityIds = [
			...new Set(params.entityIds),
		];
		const permissions = [
			...new Set(params.permissions),
		];

		if (entityIds.length === 0 || permissions.length === 0) {
			return granted as ReadonlyMap<
				EntityIdFor<Entity>,
				ReadonlySet<Permission>
			>;
		}

		const { spice } = yield* SpiceDbService;
		const subject = createSubjectReference({
			entityType: "user",
			entityId: params.userId,
		});

		const consistency = createConsistency({
			zedToken: params.zedToken,
		});
		const items = entityIds.flatMap((entityId) =>
			permissions.map((permission) =>
				v1.CheckBulkPermissionsRequestItem.create({
					resource: createResourceReference({
						entityType: params.entityType,
						entityId,
					}),
					permission,
					subject,
				}),
			),
		);

		const responses = yield* Effect.forEach(
			Array.from(
				{
					length: Math.ceil(items.length / MAX_ITEMS_PER_REQUEST),
				},
				(_, index) =>
					items.slice(
						index * MAX_ITEMS_PER_REQUEST,
						(index + 1) * MAX_ITEMS_PER_REQUEST,
					),
			),
			(chunk) =>
				Effect.tryPromise({
					try: () =>
						spice.checkBulkPermissions(
							v1.CheckBulkPermissionsRequest.create({
								consistency,
								items: chunk,
							}),
						),
					catch: (error) =>
						new SpiceDbError({
							operation: "query",
							cause: error,
						}),
				}),
		);

		for (const pair of responses.flatMap((response) => response.pairs)) {
			if (pair.response.oneofKind !== "item") {
				return yield* new SpiceDbError({
					operation: "query",
					cause: new Error(
						`Bulk check of ${params.entityType}:${pair.request?.resource?.objectId}#${pair.request?.permission} failed: ${
							pair.response.oneofKind === "error"
								? pair.response.error.message
								: "empty response"
						}`,
					),
				});
			}

			const entityId = pair.request?.resource?.objectId as
				| EntityIdFor<Entity>
				| undefined;
			if (
				entityId === undefined ||
				pair.response.item.permissionship !==
					v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
			) {
				continue;
			}

			const entityPermissions = granted.get(entityId) ?? new Set<Permission>();
			entityPermissions.add(pair.request?.permission as Permission);
			granted.set(entityId, entityPermissions);
		}

		return granted as ReadonlyMap<EntityIdFor<Entity>, ReadonlySet<Permission>>;
	});

/** The ids among `entityIds` the user holds `permission` on, in one round trip. */
export const permittedEntityIds = <Entity extends EntityType>(params: {
	entityIds: readonly EntityIdFor<Entity>[];
	entityType: Entity;
	permission: PermissionFor<Entity>;
	userId: UserId;
	zedToken?: string | null | undefined;
}) =>
	grantedPermissions({
		...params,
		permissions: [
			params.permission,
		],
	}).pipe(
		Effect.map(
			(granted): ReadonlySet<EntityIdFor<Entity>> => new Set(granted.keys()),
		),
	);
