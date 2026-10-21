import type { InstanceRole, OrganizationRole, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { writeRelationshipMutations } from "@orcai/spice-db";
import * as Effect from "effect/Effect";

const uniqueSuffix = () => crypto.randomUUID();

export const createUser = (params?: { role?: InstanceRole }) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const suffix = uniqueSuffix();
		const now = new Date();
		const [user] = yield* db
			.insert(dbSchema.user)
			.values({
				name: `Integration ${suffix}`,
				email: `integration-${suffix}@example.test`,
				emailVerified: true,
				role: params?.role ?? "user",
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		return user;
	});

/** An organization whose members hold their role in Postgres and SpiceDB. */
export const createOrganization = (params?: {
	members?: ReadonlyArray<{
		userId: UserId;
		role: OrganizationRole;
	}>;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const suffix = uniqueSuffix();
		const members = params?.members ?? [];
		const now = new Date();
		const [organization] = yield* db
			.insert(dbSchema.organization)
			.values({
				name: `Integration ${suffix}`,
				slug: `integration-${suffix}`,
				createdAt: now,
			})
			.returning();
		if (members.length > 0) {
			yield* db.insert(dbSchema.member).values(
				members.map((member) => ({
					organizationId: organization.id,
					userId: member.userId,
					role: member.role,
					createdAt: now,
				})),
			);
		}
		const { zedToken } = yield* writeRelationshipMutations(
			members.map((member) => ({
				resourceType: "organization" as const,
				resourceId: organization.id,
				relation: member.role,
				subjectType: "user" as const,
				subjectId: member.userId,
			})),
		);
		return {
			organization,
			zedToken,
		};
	});
