import {
	principalTypeSchema,
	type ResourceType,
	resourceIdentitySchema,
	resourcePrincipalIdentitySchema,
	resourceTypeSchema,
} from "@orcai/schema";
import type * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { expectType } from "../procedure-tool";
import { principalRef } from "./summary-refs";

/**
 * The resource as flat fields: the contract's discriminated unions convert to
 * a top-level `oneOf`, which providers reject as a tool schema.
 */
export const resourceTargetShape = {
	resourceType: resourceTypeSchema.describe(
		"bot, block (a template or repository) or asset.",
	),
	resourceId: z
		.uuidv4()
		.describe("Id of the bot, block or asset, from the find tools."),
};

export const principalShape = {
	principalType: principalTypeSchema,
	principalId: z
		.uuidv4()
		.describe("Id of the user or group, from findPrincipals or listAccess."),
};

/** Reads a not-found failure on the resource as a wrong id for its type. */
export const expectResource = (input: {
	resourceType: ResourceType;
	resourceId: string;
}) => expectType(input.resourceType, input.resourceId);

/** Reads a not-found failure on a principal as a wrong member or group id. */
export const expectPrincipals =
	(
		principals: readonly {
			principalType: "user" | "group";
			principalId: string;
		}[],
	) =>
	<A, E, R>(effect: Effect.Effect<A, E, R>) => {
		const refs = principals.map(principalRef);
		const idsOf = (kind: "member" | "group") =>
			refs.filter((ref) => ref.kind === kind).map((ref) => ref.id);

		return effect.pipe(
			expectType("member", idsOf("member")),
			expectType("group", idsOf("group")),
		);
	};

export const toResourceIdentity = (input: {
	resourceType: ResourceType;
	resourceId: string;
}) =>
	resourceIdentitySchema.parse({
		resourceType: input.resourceType,
		resourceId: input.resourceId,
	});

export const toPrincipalIdentity = (input: {
	principalType: "user" | "group";
	principalId: string;
}) =>
	resourcePrincipalIdentitySchema.parse({
		principalType: input.principalType,
		principalId: input.principalId,
	});
