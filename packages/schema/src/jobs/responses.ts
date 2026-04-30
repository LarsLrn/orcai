import {
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared";
import { jobHistoryEntrySchema } from "./schema";

export const listJobsResponseSchema = createListResponseSchema(
	jobHistoryEntrySchema,
);

export const createJobResponseSchema = createDeleteResponseSchema();

export const retryProcessingResponseSchema = createDeleteResponseSchema();

export const retryVectorizationResponseSchema = createDeleteResponseSchema();
