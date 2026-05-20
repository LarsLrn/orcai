import type { OrganizationInvitationId } from "@orcai/core";
import { createUuidIdSchema } from "../shared/id-schema";

export const organizationInvitationIdSchema =
	createUuidIdSchema<OrganizationInvitationId>();
