import { ORGANIZATION_ROLES, type OrganizationRole } from "@orcai/core";
import { z } from "zod/v4";

export const organizationRoleSchema = z.enum(ORGANIZATION_ROLES);

export type { OrganizationRole };
