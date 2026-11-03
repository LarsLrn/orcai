import {
	AUTHZ_CAPABILITIES_BY_ENTITY,
	AUTHZ_CAPABILITY_ENTITY_TYPES,
	type CapabilityEntityType,
	type CapabilityFor,
	type EntityCapabilities,
} from "@orcai/core";
import { z } from "zod/v4";

export const capabilityEntityTypeSchema = z.enum(AUTHZ_CAPABILITY_ENTITY_TYPES);

export const organizationCapabilitySchema = z.enum(
	AUTHZ_CAPABILITIES_BY_ENTITY.organization,
);

const groupCapabilitySchema = z.enum(AUTHZ_CAPABILITIES_BY_ENTITY.group);

export const botCapabilitySchema = z.enum(AUTHZ_CAPABILITIES_BY_ENTITY.bot);

const blockCapabilitySchema = z.enum(AUTHZ_CAPABILITIES_BY_ENTITY.block);

export const assetCapabilitySchema = z.enum(AUTHZ_CAPABILITIES_BY_ENTITY.asset);

const chatCapabilitySchema = z.enum(AUTHZ_CAPABILITIES_BY_ENTITY.chat);

export const capabilitySchema = z.union([
	organizationCapabilitySchema,
	groupCapabilitySchema,
	botCapabilitySchema,
	blockCapabilitySchema,
	assetCapabilitySchema,
	chatCapabilitySchema,
]);

export const entityCapabilitiesSchema = z.record(z.string(), z.boolean());

export type { CapabilityEntityType, CapabilityFor, EntityCapabilities };
export type OrganizationCapability = CapabilityFor<"organization">;
