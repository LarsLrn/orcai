import type { CapabilityEntityType } from "@orcai/schema";
import type { EntityIdFor } from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { createProcedures } from "@/lib/orpc/implementation/procedures";
import {
	getEntityCapabilities,
	getManyEntityCapabilities,
} from "./helpers/capabilities";

const checkAuthorization = authed.authorization.check.effect(function* ({
	input,
	context,
}) {
	const capabilities = yield* getEntityCapabilities({
		entityType: input.entityType,
		entityId: input.entityId as EntityIdFor<CapabilityEntityType>,
		permissions: [
			input.permission,
		],
		userId: context.auth.user.id,
		zedToken: getZedToken(context, input),
	});

	return {
		data: {
			allowed: capabilities[input.permission] === true,
		},
	};
});

const checkManyAuthorization = authed.authorization.checkMany.effect(
	function* ({ input, context }) {
		const capabilities = yield* getManyEntityCapabilities({
			entityType: input.entityType,
			entityIds: input.entityIds as EntityIdFor<CapabilityEntityType>[],
			permissions: input.permissions,
			userId: context.auth.user.id,
			zedToken: getZedToken(context, input),
		});

		return {
			data: {
				entities: Object.fromEntries(capabilities),
			},
		};
	},
);

const organizationCapabilities =
	authed.authorization.organizationCapabilities.effect(function* ({
		input,
		context,
	}) {
		const organizationId = context.auth.session.activeOrganizationId;
		if (!organizationId) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "ACTIVE_ORGANIZATION_REQUIRED",
					message:
						"An active organization must be selected to check capabilities.",
				}),
			);
		}

		const capabilities = yield* getEntityCapabilities({
			entityType: "organization",
			entityId: organizationId,
			permissions: input.permissions,
			userId: context.auth.user.id,
			zedToken: getZedToken(context, input),
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

export const authorizationProcedures = createProcedures(
	"authorization",
	authorizationRouter,
);
