import { createDataResponseSchema } from "../shared";
import { dataExportSchema } from "./schema";

/** The user's newest export, or null when they never requested one. */
export const findLatestDataExportResponseSchema = createDataResponseSchema(
	dataExportSchema.nullable(),
);

export const requestDataExportResponseSchema =
	createDataResponseSchema(dataExportSchema);
