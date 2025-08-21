import { v1 } from "@authzed/authzed-node";
import { getSpiceClient } from ".";
import type { Action, Consistency, EntityType, Relation } from "./types";

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

	return await spiceClient.writeRelationships(writeRequest);
};

export const checkRelation = async ({
	entityId,
	entityType,
	action,
	userId,
	consistency = "minimizeLatency",
}: {
	entityId: string;
	entityType: EntityType;
	action: Action;
	userId: string;
	consistency?: Consistency;
}) => {
	const resource = v1.ObjectReference.create({
		objectType: entityType,
		objectId: entityId,
	});

	const user = v1.ObjectReference.create({
		objectType: "user",
		objectId: userId,
	});

	const consistencyMinimizeLatency = v1.Consistency.create({
		requirement: {
			oneofKind: "minimizeLatency",
			minimizeLatency: true,
		},
	});

	const consistencyFullyConsistent = v1.Consistency.create({
		requirement: {
			oneofKind: "fullyConsistent",
			fullyConsistent: true,
		},
	});

	return await spiceClient.checkPermission(
		v1.CheckPermissionRequest.create({
			consistency:
				consistency === "minimizeLatency"
					? consistencyMinimizeLatency
					: consistencyFullyConsistent,
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
