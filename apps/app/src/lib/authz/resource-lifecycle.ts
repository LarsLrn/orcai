import type { OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { EntityIdFor, ResourceType, TupleMutation } from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import { AuthzService } from "@/lib/effect/services/authz";

type ResourceVisibility =
	typeof dbSchema.resourceVisibility.$inferSelect.visibility;

type InitialRelation = "owner" | "manager";

/**
 * Bootstraps the authorization state for a newly created resource.
 *
 * Writes three categories of data:
 * 1. **DB records** — `resourceScope` (org ownership), `resourceVisibility`,
 *    and optionally a `resourceGrant` row for the creator.
 * 2. **SpiceDB tuples** — creator relation (`owner` or `manager`), and a
 *    `public@user:*` wildcard when visibility is public.
 *
 * Must be called once, immediately after the resource row is inserted.
 *
 * @param params.visibility      - Defaults to `"private"`.
 * @param params.initialRelation - Overrides the per-type default (`"owner"` for
 *                                 most types).
 * @param params.writeManagerGrant - Whether to write a `resourceGrant` row for
 *                                   the creator. Defaults to `true` when
 *                                   `initialRelation` is `"manager"`.
 */
export const initializeResourceAuthorization = (params: {
	resourceType: ResourceType;
	resourceId: EntityIdFor<ResourceType>;
	organizationId: OrganizationId;
	ownerUserId: UserId;
	visibility?: ResourceVisibility;
	initialRelation?: InitialRelation;
	writeManagerGrant?: boolean;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const authz = yield* AuthzService;
		const now = new Date();

		const visibility = params.visibility ?? "private";
		const initialRelation = params.initialRelation ?? "owner";
		const writeManagerGrant =
			params.writeManagerGrant ?? initialRelation === "manager";

		yield* db.insert(dbSchema.resourceScope).values({
			resourceType: params.resourceType,
			resourceId: params.resourceId,
			organizationId: params.organizationId,
			isPrimary: true,
			assignedAt: now,
			assignedBy: params.ownerUserId,
			endedAt: null,
		});

		yield* db.insert(dbSchema.resourceVisibility).values({
			resourceType: params.resourceType,
			resourceId: params.resourceId,
			visibility,
			updatedBy: params.ownerUserId,
			updatedAt: now,
		});

		if (writeManagerGrant) {
			yield* db.insert(dbSchema.resourceGrant).values({
				resourceType: params.resourceType,
				resourceId: params.resourceId,
				principalType: "user",
				principalId: params.ownerUserId,
				role: "manager",
				grantedBy: params.ownerUserId,
				createdAt: now,
				revokedAt: null,
			});
		}

		const mutations: TupleMutation[] = [
			{
				resourceType: params.resourceType,
				resourceId: params.resourceId,
				relation: initialRelation,
				subjectType: "user" as const,
				subjectId: params.ownerUserId,
				operation: "touch" as const,
			},
			...(visibility === "public"
				? [
						{
							resourceType: params.resourceType,
							resourceId: params.resourceId,
							relation: "public" as const,
							subjectType: "user" as const,
							subjectId: "*" as const,
							operation: "touch" as const,
						},
					]
				: []),
		];

		return yield* authz.applyRelationshipMutations({
			mutations,
		});
	});
