import { v1 } from "@authzed/authzed-node";

export const createResourceReference = (params: {
	entityType: string;
	entityId: string;
}) =>
	v1.ObjectReference.create({
		objectType: params.entityType,
		objectId: params.entityId,
	});

export const createUserReference = (params: { userId: string }) =>
	createResourceReference({
		entityType: "user",
		entityId: params.userId,
	});

export const createConsistency = (params: {
	zedToken: v1.ZedToken["token"] | null | undefined;
}) =>
	v1.Consistency.create({
		requirement: params.zedToken
			? {
					oneofKind: "atLeastAsFresh",
					atLeastAsFresh: {
						token: params.zedToken ?? "",
					},
				}
			: {
					oneofKind: "minimizeLatency",
					minimizeLatency: true,
				},
	});
