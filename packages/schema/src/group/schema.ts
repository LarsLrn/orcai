import type { GroupId, GroupMemberId } from "@orcai/core";
import { createUuidIdSchema } from "../shared";

// Stub entrypoint for the group resource migration.
export const groupIdSchema = createUuidIdSchema<GroupId>();
export const groupMemberIdSchema = createUuidIdSchema<GroupMemberId>();
