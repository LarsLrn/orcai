import type { MemberId, OrganizationId } from "@orcai/core";
import { createUuidIdSchema } from "../shared";

// Stub entrypoint for the organization resource migration.
export const organizationIdSchema = createUuidIdSchema<OrganizationId>();
export const memberIdSchema = createUuidIdSchema<MemberId>();
