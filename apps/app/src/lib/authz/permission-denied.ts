import type { EntityType, ReadRevision } from "@orcai/spice-db";
import * as AppErrors from "@/lib/effect/utils/errors";

/** The denial every permission check fails with; the message is what the assistant's model reads. */
export const permissionDenied = (params: {
	entityType: EntityType;
	permission: string;
	zedToken?: ReadRevision;
}) =>
	new AppErrors.ForbiddenError({
		reason: "PERMISSION_DENIED",
		message: `You do not have the "${params.permission}" permission on this ${params.entityType}.`,
		data: {
			entityType: params.entityType,
			permission: params.permission,
			zedToken:
				typeof params.zedToken === "string" ? params.zedToken : undefined,
		},
	});
