import type { MemberId, OrganizationId } from "@orcai/core";
import { createUuidIdSchema } from "../shared/id-schema";

export const organizationIdSchema = createUuidIdSchema<OrganizationId>();
export const memberIdSchema = createUuidIdSchema<MemberId>();
