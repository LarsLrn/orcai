import {
	createDataResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared";
import { groupSchema } from "./schema";
import {
	groupListRowSchema,
	groupMemberRowSchema,
	groupMemberUserSchema,
} from "./views";

export const listGroupsResponseSchema =
	createListResponseSchema(groupListRowSchema);

export const findGroupResponseSchema = createDataResponseSchema(groupSchema);

export const groupWriteResponseSchema = createDataResponseSchema(groupSchema);

export const listGroupMembersResponseSchema =
	createListResponseSchema(groupMemberRowSchema);

export const listGroupCandidatesResponseSchema = createListResponseSchema(
	groupMemberUserSchema,
);

export const groupMembersMutateResponseSchema = statusResponseSchema;
