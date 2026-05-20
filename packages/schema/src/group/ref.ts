import type { GroupId, GroupMemberId } from "@orcai/core";
import { createUuidIdSchema } from "../shared/id-schema";

export const groupIdSchema = createUuidIdSchema<GroupId>();
export const groupMemberIdSchema = createUuidIdSchema<GroupMemberId>();
