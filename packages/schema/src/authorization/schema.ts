import {
	AUTHZ_CAPABILITIES_BY_ENTITY,
	AUTHZ_CAPABILITY_ENTITY_TYPES,
	type Capability,
	type CapabilityByEntity,
	type CapabilityEntityType,
	type CapabilityFor,
	type EntityCapabilities,
} from "@orcai/core";
import { z } from "zod/v4";

export const capabilityEntityTypeSchema = z.enum(AUTHZ_CAPABILITY_ENTITY_TYPES);

export const organizationCapabilitySchema = z.enum(
	AUTHZ_CAPABILITIES_BY_ENTITY.organization,
);

export const groupCapabilitySchema = z.enum(AUTHZ_CAPABILITIES_BY_ENTITY.group);

export const botCapabilitySchema = z.enum(AUTHZ_CAPABILITIES_BY_ENTITY.bot);

export const blockCapabilitySchema = z.enum(AUTHZ_CAPABILITIES_BY_ENTITY.block);

export const assetCapabilitySchema = z.enum(AUTHZ_CAPABILITIES_BY_ENTITY.asset);

export const chatCapabilitySchema = z.enum(AUTHZ_CAPABILITIES_BY_ENTITY.chat);

export const capabilitySchema = z.union([
	organizationCapabilitySchema,
	groupCapabilitySchema,
	botCapabilitySchema,
	blockCapabilitySchema,
	assetCapabilitySchema,
	chatCapabilitySchema,
]);

export const capabilityByEntitySchema = {
	organization: organizationCapabilitySchema,
	group: groupCapabilitySchema,
	bot: botCapabilitySchema,
	block: blockCapabilitySchema,
	asset: assetCapabilitySchema,
	chat: chatCapabilitySchema,
} as const;

export const entityCapabilitiesSchema = z.record(z.string(), z.boolean());

export type {
	Capability,
	CapabilityByEntity,
	CapabilityEntityType,
	CapabilityFor,
	EntityCapabilities,
};
export type OrganizationCapability = CapabilityFor<"organization">;
export type GroupCapability = CapabilityFor<"group">;
export type BotCapability = CapabilityFor<"bot">;
export type BlockCapability = CapabilityFor<"block">;
export type AssetCapability = CapabilityFor<"asset">;
export type ChatCapability = CapabilityFor<"chat">;
