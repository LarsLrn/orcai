import { z } from "zod/v4";
import { dataExportIdSchema } from "../shared/ids";

/** The statuses an export is stored with. */
export const DATA_EXPORT_STATUSES = [
	"pending",
	"processing",
	"ready",
	"failed",
] as const;

/** `expired` is a ready export past its expiry; the archive is gone. */
export const dataExportStatusSchema = z.enum([
	...DATA_EXPORT_STATUSES,
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
