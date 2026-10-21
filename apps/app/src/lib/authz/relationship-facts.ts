import type {
	AssetId,
	BlockId,
	BotId,
	ChatId,
	GroupId,
	OrganizationId,
	OrganizationRole,
	UserId,
} from "@orcai/core";
import { ORGANIZATION_ROLES } from "@orcai/core";
import type { ResourceGrantRole, ResourceVisibility } from "@orcai/schema";
import type { RelationshipFor, TupleMutation } from "@orcai/spice-db";
import * as Arr from "effect/Array";
import * as Data from "effect/Data";

export type ResourceRef =
	| {
			resourceType: "bot";
			resourceId: BotId;
	  }
	| {
			resourceType: "block";
			resourceId: BlockId;
	  }
	| {
			resourceType: "asset";
			resourceId: AssetId;
	  };

export type GrantPrincipal =
	| {
			principalType: "user";
			principalId: UserId;
	  }
	| {
			principalType: "group";
			principalId: GroupId;
	  };

/** An organization's group; the All Members group's members are the organization's roles. */
type GroupRef = {
	groupId: GroupId;
	organizationId: OrganizationId;
	allMembers: boolean;
};

/**
 * A change to business rows that SpiceDB must mirror. `from`/`to` of `null`
 * mean absent; link sets carry the ids before and after, and need only cover
 * the ids that may have changed.
 */
export type RelationshipFact = Data.TaggedEnum<{
	ResourceCreated: {
		resource: ResourceRef;
		ownerId: UserId;
		visibility: ResourceVisibility;
	};
	ResourceDeleted: {
		resource: ResourceRef;
		ownerId: UserId;
	};
	ResourceVisibilitySet: {
		resource: ResourceRef;
		visibility: ResourceVisibility;
	};
	ResourceGrantChanged: {
		resource: ResourceRef;
		principal: GrantPrincipal;
		from: ResourceGrantRole | null;
		to: ResourceGrantRole | null;
	};
	OrganizationRoleChanged: {
		organizationId: OrganizationId;
		userId: UserId;
		from: OrganizationRole | null;
		to: OrganizationRole | null;
	};
	GroupCreated: GroupRef;
	GroupDeleted: GroupRef;
	GroupMembershipChanged: {
		groupId: GroupId;
		userId: UserId;
		member: boolean;
	};
	BotBlocksChanged: {
		botId: BotId;
		before: readonly BlockId[];
		after: readonly BlockId[];
	};
	BlockAssetsChanged: {
		blockId: BlockId;
		before: readonly AssetId[];
		after: readonly AssetId[];
	};
	ChatCreated: {
		chatId: ChatId;
		ownerId: UserId;
		botId: BotId | null;
	};
	ChatBotUnlinked: {
		chatId: ChatId;
		botId: BotId;
	};
}>;

export const RelationshipFact = Data.taggedEnum<RelationshipFact>();

type Operation = "touch" | "delete";

const resourceTuple = (
	resource: ResourceRef,
	relation: RelationshipFor<ResourceRef["resourceType"]>,
	operation: Operation,
	subject:
		| {
				subjectType: "user";
				subjectId: UserId | "*";
		  }
		| {
				subjectType: "group";
				subjectId: GroupId;
				subjectRelation: "member";
		  },
): TupleMutation => ({
	resourceType: resource.resourceType,
	resourceId: resource.resourceId,
	relation,
	...subject,
	operation,
});

const publicTuple = (resource: ResourceRef, operation: Operation) =>
	resourceTuple(resource, "public", operation, {
		subjectType: "user",
		subjectId: "*",
	});

const principalSubject = (principal: GrantPrincipal) =>
	principal.principalType === "group"
		? {
				subjectType: "group" as const,
				subjectId: principal.principalId,
				subjectRelation: "member" as const,
			}
		: {
				subjectType: "user" as const,
				subjectId: principal.principalId,
			};

const groupTuples = (
	{ groupId, organizationId, allMembers }: GroupRef,
	operation: Operation,
): TupleMutation[] => [
	{
		resourceType: "group",
		resourceId: groupId,
		relation: "organization",
		subjectType: "organization",
		subjectId: organizationId,
		operation,
	},
	...(allMembers
		? ORGANIZATION_ROLES.map(
				(role): TupleMutation => ({
					resourceType: "group",
					resourceId: groupId,
					relation: "member",
					subjectType: "organization",
					subjectId: organizationId,
					subjectRelation: role,
					operation,
				}),
			)
		: []),
];

const roleChange = <Role extends string>(
	from: Role | null,
	to: Role | null,
	tuple: (role: Role, operation: Operation) => TupleMutation,
): TupleMutation[] => [
	...(from !== null && from !== to
		? [
				tuple(from, "delete"),
			]
		: []),
	...(to !== null
		? [
				tuple(to, "touch"),
			]
		: []),
];

const linkChange = <Id extends string>(
	before: readonly Id[],
	after: readonly Id[],
	tuple: (id: Id, operation: Operation) => TupleMutation,
): TupleMutation[] => {
	const beforeIds = Arr.dedupe(before);
	const afterIds = Arr.dedupe(after);
	return [
		...Arr.difference(beforeIds, afterIds).map((id) => tuple(id, "delete")),
		...Arr.difference(afterIds, beforeIds).map((id) => tuple(id, "touch")),
	];
};

const projectFact = RelationshipFact.$match({
	ResourceCreated: ({ resource, ownerId, visibility }) => [
		resourceTuple(resource, "owner", "touch", {
			subjectType: "user",
			subjectId: ownerId,
		}),
		...(visibility === "public"
			? [
					publicTuple(resource, "touch"),
				]
			: []),
	],
	ResourceDeleted: ({ resource, ownerId }) => [
		resourceTuple(resource, "owner", "delete", {
			subjectType: "user",
			subjectId: ownerId,
		}),
		publicTuple(resource, "delete"),
	],
	ResourceVisibilitySet: ({ resource, visibility }) => [
		publicTuple(resource, visibility === "public" ? "touch" : "delete"),
	],
	ResourceGrantChanged: ({ resource, principal, from, to }) =>
		roleChange(from, to, (role, operation) =>
			resourceTuple(resource, role, operation, principalSubject(principal)),
		),
	OrganizationRoleChanged: ({ organizationId, userId, from, to }) =>
		roleChange(
			from,
			to,
			(role, operation): TupleMutation => ({
				resourceType: "organization",
				resourceId: organizationId,
				relation: role,
				subjectType: "user",
				subjectId: userId,
				operation,
			}),
		),
	GroupCreated: (group) => groupTuples(group, "touch"),
	GroupDeleted: (group) => groupTuples(group, "delete"),
	GroupMembershipChanged: ({ groupId, userId, member }): TupleMutation[] => [
		{
			resourceType: "group",
			resourceId: groupId,
			relation: "member",
			subjectType: "user",
			subjectId: userId,
			operation: member ? "touch" : "delete",
		},
	],
	BotBlocksChanged: ({ botId, before, after }) =>
		linkChange(
			before,
			after,
			(blockId, operation): TupleMutation => ({
				resourceType: "block",
				resourceId: blockId,
				relation: "bot",
				subjectType: "bot",
				subjectId: botId,
				operation,
			}),
		),
	BlockAssetsChanged: ({ blockId, before, after }) =>
		linkChange(
			before,
			after,
			(assetId, operation): TupleMutation => ({
				resourceType: "asset",
				resourceId: assetId,
				relation: "block",
				subjectType: "block",
				subjectId: blockId,
				operation,
			}),
		),
	ChatCreated: ({ chatId, ownerId, botId }): TupleMutation[] => [
		{
			resourceType: "chat",
			resourceId: chatId,
			relation: "owner",
			subjectType: "user",
			subjectId: ownerId,
			operation: "touch",
		},
		...(botId !== null
			? [
					{
						resourceType: "chat",
						resourceId: chatId,
						relation: "bot",
						subjectType: "bot",
						subjectId: botId,
						operation: "touch",
					} satisfies TupleMutation,
				]
			: []),
	],
	ChatBotUnlinked: ({ chatId, botId }): TupleMutation[] => [
		{
			resourceType: "chat",
			resourceId: chatId,
			relation: "bot",
			subjectType: "bot",
			subjectId: botId,
			operation: "delete",
		},
	],
});

const tupleKey = (mutation: TupleMutation) =>
	`${mutation.resourceType}:${mutation.resourceId}#${mutation.relation}@${mutation.subjectType}:${mutation.subjectId}#${mutation.subjectRelation ?? ""}`;

/**
 * The tuple changes that bring SpiceDB in line with the facts, applied in
 * order: when several facts touch one tuple, the last one wins.
 */
export const projectRelationshipFacts = (
	facts: readonly RelationshipFact[],
): TupleMutation[] => {
	const mutations = facts.flatMap((fact): TupleMutation[] => projectFact(fact));
	const last = new Map(
		mutations.map((mutation, index) => [
			tupleKey(mutation),
			index,
		]),
	);
	return mutations.filter(
		(mutation, index) => last.get(tupleKey(mutation)) === index,
	);
};
