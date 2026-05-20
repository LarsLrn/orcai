import {
	createDataResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared";
import { groupSchema } from "./schema";
import { groupMemberRowSchema } from "./views";

export const listGroupsResponseSchema = createListResponseSchema(groupSchema);

export const findGroupResponseSchema = createDataResponseSchema(groupSchema);

export const groupWriteResponseSchema = createDataResponseSchema(groupSchema);

export const listGroupMembersResponseSchema =
	createListResponseSchema(groupMemberRowSchema);

export const groupMembersMutateResponseSchema = statusResponseSchema;
