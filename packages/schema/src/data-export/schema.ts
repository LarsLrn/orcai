import { z } from "zod/v4";
import { dataExportIdSchema } from "./ref";

/** `expired` is a ready export past its expiry; the archive is gone. */
export const dataExportStatusSchema = z.enum([
	"pending",
	"processing",
	"ready",
	"failed",
	"expired",
]);

export const dataExportSchema = z.object({
	id: dataExportIdSchema,
	status: dataExportStatusSchema,
	size: z.number().nullable(),
	createdAt: z.coerce.date(),
	completedAt: z.coerce.date().nullable(),
	expiresAt: z.coerce.date().nullable(),
});

export type DataExportStatus = z.infer<typeof dataExportStatusSchema>;
export type DataExport = z.infer<typeof dataExportSchema>;
