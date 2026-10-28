import type { DataExportId, UserId } from "@orcai/core";

/** Data export archives live here. */
export const DATA_EXPORT_PREFIX = "exports/";

/** How long a ready archive can be downloaded; the workers delete archives older than this. */
export const DATA_EXPORT_TTL_MS = 24 * 60 * 60_000;

export const dataExportKey = (params: {
	userId: UserId;
	dataExportId: DataExportId;
}) => `${DATA_EXPORT_PREFIX}users/${params.userId}/${params.dataExportId}.zip`;
