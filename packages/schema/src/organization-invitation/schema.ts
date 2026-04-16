import type { OrganizationInvitationId } from "@orcai/core";
import { createUuidIdSchema } from "../shared";

// Stub entrypoint for the organization-invitation resource migration.
export const organizationInvitationIdSchema =
	createUuidIdSchema<OrganizationInvitationId>();
