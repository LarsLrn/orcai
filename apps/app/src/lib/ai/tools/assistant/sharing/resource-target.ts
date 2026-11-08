import {
	type ResourceType,
	resourceIdentitySchema,
	resourcePrincipalIdentitySchema,
} from "@orcai/schema";
import type * as Effect from "effect/Effect";
import { expectType } from "../procedure-tool";
import { granteeRef } from "./summary-refs";

/** Reads a not-found failure on the target as a wrong id for its type. */
export const expectTarget = (input: {
	targetType: ResourceType;
	targetId: string;
}) => expectType(input.targetType, input.targetId);

/** Reads a not-found failure on a grantee as a wrong member or group id. */
export const expectGrantees =
	(
		grantees: readonly {
			granteeType: "user" | "group";
			granteeId: string;
		}[],
	) =>
	<A, E, R>(effect: Effect.Effect<A, E, R>) => {
		const refs = grantees.map(granteeRef);
		const idsOf = (kind: "member" | "group") =>
			refs.filter((ref) => ref.kind === kind).map((ref) => ref.id);

		return effect.pipe(
			expectType("member", idsOf("member")),
			expectType("group", idsOf("group")),
		);
	};

export const toResourceIdentity = (input: {
	targetType: ResourceType;
	targetId: string;
}) =>
	resourceIdentitySchema.parse({
		resourceType: input.targetType,
		resourceId: input.targetId,
	});

export const toPrincipalIdentity = (input: {
	granteeType: "user" | "group";
	granteeId: string;
}) =>
	resourcePrincipalIdentitySchema.parse({
		principalType: input.granteeType,
		principalId: input.granteeId,
	});
