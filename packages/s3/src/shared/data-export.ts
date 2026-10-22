import type { DataExportId, UserId } from "@orcai/core";

/** Data export archives live here; lifecycle expires them. */
export const DATA_EXPORT_PREFIX = "exports/";

export const dataExportKey = (params: {
	userId: UserId;
	dataExportId: DataExportId;
}) => `${DATA_EXPORT_PREFIX}users/${params.userId}/${params.dataExportId}.zip`;
