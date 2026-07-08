import { v1 } from "@authzed/authzed-node";
import * as Effect from "effect/Effect";
import type { SpiceConvergeOperation } from "../types";

const roleRelationMap = {
	owner: "admin",
	instructor: "manager",
	student: "member",
} as const;

const oldRelations = Object.keys(roleRelationMap) as Array<
	keyof typeof roleRelationMap
>;

const organizationRoleCompatibilitySchema = `definition user {}

definition organization {
	relation owner: user
	relation instructor: user
	relation student: user
	relation admin: user
	relation manager: user
	relation member: user
	relation viewer: user

	permission legacy_admin = owner
	permission legacy_member = owner + instructor + student
	permission read = admin + manager + member + viewer + legacy_member
	permission manage_organization = admin + legacy_admin
	permission manage_members = admin + manager + legacy_admin
	permission manage_groups = admin + manager + legacy_admin
	permission invite = owner + instructor
	permission invite_members = admin + manager + owner + instructor
	permission create_bot = admin + manager + member + owner + instructor
	permission create_block = admin + manager + member + owner + instructor
	permission create_asset = admin + manager + member + owner + instructor
	permission manage_providers = admin + legacy_admin
	permission manage_models = admin + legacy_admin
	permission manage_quotas = admin + legacy_admin
}

definition group {
	relation organization: organization
	relation member: user | organization#owner | organization#instructor | organization#student | organization#admin | organization#manager | organization#member | organization#viewer

	permission read = organization->read
	permission manage = organization->manage_groups
}

definition bot {
	relation owner: user
	relation manager: user | group#member
	relation editor: user | group#member
	relation viewer: user | group#member
	relation public: user:*

	permission read = owner + manager + editor + viewer + public
	permission use = read
	permission fork = read
	permission edit = owner + manager + editor
	permission delete = owner + manager
	permission manage_access = owner + manager
}

definition block {
	relation owner: user
	relation manager: user | group#member
	relation editor: user | group#member
	relation viewer: user | group#member
	relation public: user:*
	relation bot: bot

	permission read = owner + manager + editor + viewer + bot->read + public
	permission use = read
	permission fork = read
	permission edit = owner + manager + editor + bot->edit
	permission delete = owner + manager
	permission manage_access = owner + manager
}

definition asset {
	relation owner: user
	relation manager: user | group#member
	relation editor: user | group#member
	relation viewer: user | group#member
	relation public: user:*
	relation block: block

	permission read = owner + manager + editor + viewer + block->read + public
	permission download = read
	permission use = read
	permission fork = read
	permission edit = owner + manager + editor + block->edit
	permission delete = owner + manager
	permission manage_access = owner + manager
}

definition chat {
	relation owner: user
	relation bot: bot

	permission read = owner
	permission edit = owner
	permission delete = owner
}`;

const cloneRelationship = (
	relationship: v1.Relationship,
	overrides: Partial<Pick<v1.Relationship, "relation" | "subject">>,
) =>
	v1.Relationship.create({
		...relationship,
		...overrides,
		resource: relationship.resource
			? v1.ObjectReference.create(relationship.resource)
			: undefined,
		subject: overrides.subject ?? relationship.subject,
	});

const rewriteOrganizationRelation = (
	relationship: v1.Relationship,
	newRelation: string,
) =>
	cloneRelationship(relationship, {
		relation: newRelation,
	});

const rewriteOrganizationSubjectRelation = (
	relationship: v1.Relationship,
	newRelation: string,
) => {
	if (!relationship.subject?.object) {
		return undefined;
	}

	return cloneRelationship(relationship, {
		subject: v1.SubjectReference.create({
			object: v1.ObjectReference.create(relationship.subject.object),
			optionalRelation: newRelation,
		}),
	});
};

export const rewriteOrganizationRoleTuplesOperation: SpiceConvergeOperation = {
	id: "020-rewrite-organization-role-tuples",
	description:
		"Rewrite legacy organization owner/instructor/student tuples to admin/manager/member",
	shouldRun: Effect.fn("rewriteOrganizationRoleTuplesOperation.shouldRun")(
		function* (context) {
			const currentSchema = yield* context.readCurrentSchema();
			return oldRelations.some((relation) =>
				currentSchema.includes(`relation ${relation}: user`),
			);
		},
	),
	run: Effect.fn("rewriteOrganizationRoleTuplesOperation.run")(
		function* (context) {
			const currentSchema = yield* context.readCurrentSchema();
			if (!currentSchema.includes("relation admin: user")) {
				yield* context.log(
					"Applying temporary organization role compatibility schema...",
				);
				yield* context.writeSchema(organizationRoleCompatibilitySchema);
			}

			for (const oldRelation of oldRelations) {
				const newRelation = roleRelationMap[oldRelation];

				const directCount = yield* context.rewriteRelationshipsInBatches({
					relationshipFilter: {
						resourceType: "organization",
						optionalRelation: oldRelation,
					},
					mapRelationship: (relationship) =>
						rewriteOrganizationRelation(relationship, newRelation),
				});
				yield* context.log(
					`Rewrote ${directCount} organization#${oldRelation} tuple(s) to #${newRelation}`,
				);

				const groupSubjectCount = yield* context.rewriteRelationshipsInBatches({
					relationshipFilter: {
						resourceType: "group",
						optionalRelation: "member",
						optionalSubjectFilter: v1.SubjectFilter.create({
							subjectType: "organization",
							optionalRelation: v1.SubjectFilter_RelationFilter.create({
								relation: oldRelation,
							}),
						}),
					},
					mapRelationship: (relationship) =>
						rewriteOrganizationSubjectRelation(relationship, newRelation),
				});
				yield* context.log(
					`Rewrote ${groupSubjectCount} group subject tuple(s) from organization#${oldRelation} to #${newRelation}`,
				);
			}
		},
	),
};
