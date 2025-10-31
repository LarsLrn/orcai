import { v1 } from "@authzed/authzed-node";
import { db } from "@/db/drizzle";
import { zedTokenTable } from "@/db/schema/zed-token";
import { getSpiceClient } from ".";
import type { Action, EntityType, Relation } from "./types";

const spiceClient = getSpiceClient();

export const createRelation = async ({
	entityId,
	entityType,
	userId,
	relation,
}: {
	entityId: string;
	entityType: EntityType;
	userId: string;
	relation: Relation;
}) => {
	const resource = v1.ObjectReference.create({
		objectType: entityType,
		objectId: entityId,
	});

	const user = v1.ObjectReference.create({
		objectType: "user",
		objectId: userId,
	});

	const writeRequest = v1.WriteRelationshipsRequest.create({
		updates: [
			v1.RelationshipUpdate.create({
				relationship: v1.Relationship.create({
					resource,
					relation,
					subject: v1.SubjectReference.create({ object: user }),
				}),
				operation: v1.RelationshipUpdate_Operation.CREATE,
			}),
		],
	});

	const response = await spiceClient.writeRelationships(writeRequest);

	if (!response.writtenAt?.token) {
		throw new Error("Failed to obtain zed token from Spice write response");
	}

	const [result] = await db
		.insert(zedTokenTable)
		.values({
			resourceId: entityId,
			resourceType: entityType,
			zedToken: response.writtenAt.token,
			createdAt: new Date(),
		})
		.onConflictDoUpdate({
			target: zedTokenTable.resourceId,
			set: { zedToken: response.writtenAt.token, createdAt: new Date() },
		})
		.returning();

	return { data: result };
};

export const checkRelation = async ({
	entityId,
	entityType,
	action,
	userId,
	zedToken,
}: {
	entityId: string;
	entityType: EntityType;
	action: Action;
	userId: string;
	zedToken: v1.ZedToken["token"] | null | undefined;
}) => {
	const resource = v1.ObjectReference.create({
		objectType: entityType,
		objectId: entityId,
	});

	const user = v1.ObjectReference.create({
		objectType: "user",
		objectId: userId,
	});

	let consistency: v1.Consistency;

	if (zedToken) {
		consistency = v1.Consistency.create({
			requirement: {
				oneofKind: "atLeastAsFresh",
				atLeastAsFresh: {
					token: zedToken,
				},
			},
		});
	} else {
		consistency = v1.Consistency.create({
			requirement: {
				oneofKind: "fullyConsistent",
				fullyConsistent: true,
			},
		});
	}

	return await spiceClient.checkPermission(
		v1.CheckPermissionRequest.create({
			/* consistency:
				consistency === "minimizeLatency"
					? consistencyMinimizeLatency
					: consistencyFullyConsistent, */
			consistency,
			resource,
			permission: action,
			subject: v1.SubjectReference.create({ object: user }),
		}),
	);
};

export const checkManyRelations = async ({
	entityIds,
	entityType,
	action,
	userId,
}: {
	entityIds: string[];
	entityType: EntityType;
	action: Action;
	userId: string;
}) => {
	const resources = entityIds.map((entityId) =>
		v1.ObjectReference.create({
			objectType: entityType,
			objectId: entityId,
		}),
	);

	const user = v1.ObjectReference.create({
		objectType: "user",
		objectId: userId,
	});

	return await spiceClient.checkBulkPermissions(
		v1.CheckBulkPermissionsRequest.create({
			items: resources.map((resource) => ({
				resource,
				permission: action,
				subject: v1.SubjectReference.create({ object: user }),
			})),
		}),
	);
};

export const listAllowedEntities = async ({
	entityType,
	action,
	userId,
}: {
	entityType: EntityType;
	action: Action;
	userId: string;
}) => {
	const user = v1.ObjectReference.create({
		objectType: "user",
		objectId: userId,
	});

	const spiceResponse = await spiceClient.lookupResources(
		v1.LookupResourcesRequest.create({
			resourceObjectType: entityType,
			subject: v1.SubjectReference.create({ object: user }),
			permission: action,
		}),
	);

	return {
		spiceResponse,
		entityIds: spiceResponse.map((entity) => entity.resourceObjectId),
	};
};
