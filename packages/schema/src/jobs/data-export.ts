import { z } from "zod/v4";
import { dataExportIdSchema } from "../shared/ids";

export const dataExportPayloadSchema = z.object({
	dataExportId: dataExportIdSchema,
});

export type DataExportPayload = z.infer<typeof dataExportPayloadSchema>;
