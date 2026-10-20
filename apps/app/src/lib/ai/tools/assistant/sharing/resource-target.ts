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
	<A, E, R>(effect: Effect.Effect<A, E, R>) =>
		effect.pipe(
			expectType(
				"member",
				principals
					.filter((principal) => principal.principalType === "user")
					.map((principal) => principal.principalId),
			),
			expectType(
				"group",
				principals
					.filter((principal) => principal.principalType === "group")
					.map((principal) => principal.principalId),
			),
		);

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
