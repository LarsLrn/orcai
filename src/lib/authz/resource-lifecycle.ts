import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { AuthzService } from "@/lib/effect/services/authz";
import { DB } from "@/lib/effect/services/drizzle";
import type { ResourceType } from "@/lib/spice-db/types";

type ResourceVisibility =
	typeof dbSchema.resourceVisibility.$inferSelect.visibility;
type InitialRelation = "owner" | "manager";

const defaultInitialRelation = (resourceType: ResourceType): InitialRelation =>
	resourceType === "course" ? "manager" : "owner";

const supportsOrganizationRelation = (resourceType: ResourceType) =>
	resourceType === "course";

/**
 * Bootstraps the authorization state for a newly created resource.
 *
 * Writes three categories of data:
 * 1. **DB records** — `resourceScope` (org ownership), `resourceVisibility`,
 *    and optionally a `resourceGrant` row for the creator.
 * 2. **SpiceDB tuples** — creator relation (`owner` or `manager`), an
 *    `organization` relation for resource types that support it (currently
 *    only `course`), and a `public@user:*` wildcard when visibility is public.
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
	resourceId: string;
	organizationId: string;
	ownerUserId: string;
	visibility?: ResourceVisibility;
	initialRelation?: InitialRelation;
	writeManagerGrant?: boolean;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const authz = yield* AuthzService;
		const now = new Date();

		const visibility = params.visibility ?? "private";
		const initialRelation =
			params.initialRelation ?? defaultInitialRelation(params.resourceType);
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

		const mutations = [
			...(supportsOrganizationRelation(params.resourceType)
				? [
						{
							resourceType: params.resourceType,
							resourceId: params.resourceId,
							relation: "organization" as const,
							subjectType: "organization" as const,
							subjectId: params.organizationId,
							operation: "touch" as const,
						},
					]
				: []),
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
							subjectId: "*",
							operation: "touch" as const,
						},
					]
				: []),
		];

		return yield* authz.applyRelationshipMutations({
			mutations,
		});
	});
