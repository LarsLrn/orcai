import type { CapabilityEntityType } from "@orcai/schema";
import type { EntityIdFor } from "@orcai/spice-db";
import {
	getEntityCapabilities,
	getManyEntityCapabilities,
} from "@/lib/authz/entity-capabilities";
import { readRevision } from "@/lib/authz/zed-token";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganization } from "@/lib/orpc/middlewares/organization";

const checkAuthorization = authed.authorization.check
	.use(requireOrganization())
	.effect(function* ({ input, context }) {
		const capabilities = yield* getEntityCapabilities({
			entityType: input.entityType,
			entityId: input.entityId as EntityIdFor<CapabilityEntityType>,
			permissions: [
				input.permission,
			],
			userId: context.auth.user.id,
			organizationId: context.auth.session.activeOrganizationId,
			zedToken: readRevision(context, input),
		});

		return {
			data: {
				allowed: capabilities[input.permission] === true,
			},
		};
	});

const checkManyAuthorization = authed.authorization.checkMany
	.use(requireOrganization())
	.effect(function* ({ input, context }) {
		const capabilities = yield* getManyEntityCapabilities({
			entityType: input.entityType,
			entityIds: input.entityIds as EntityIdFor<CapabilityEntityType>[],
			permissions: input.permissions,
			userId: context.auth.user.id,
			organizationId: context.auth.session.activeOrganizationId,
			zedToken: readRevision(context, input),
		});

		return {
			data: {
				entities: Object.fromEntries(capabilities),
			},
		};
	});

const organizationCapabilities = authed.authorization.organizationCapabilities
	.use(requireOrganization())
	.effect(function* ({ input, context }) {
		const organizationId = context.auth.session.activeOrganizationId;
		const capabilities = yield* getEntityCapabilities({
			entityType: "organization",
			entityId: organizationId,
			permissions: input.permissions,
			userId: context.auth.user.id,
			organizationId,
			zedToken: readRevision(context, input),
		});

		return {
			data: {
				capabilities,
			},
		};
	});

export const authorizationRouter = {
	check: checkAuthorization,
	checkMany: checkManyAuthorization,
	organizationCapabilities,
};
