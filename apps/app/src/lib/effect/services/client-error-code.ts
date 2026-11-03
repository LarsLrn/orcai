import { COMMON_ERROR_STATUS_MAP } from "@orpc/server";

/** Whether the RPC handler answers `code` with a 4xx status; codes it has no status for get 500. */
export const isClientErrorCode = (code: string): boolean =>
	Object.hasOwn(COMMON_ERROR_STATUS_MAP, code) &&
	COMMON_ERROR_STATUS_MAP[code as keyof typeof COMMON_ERROR_STATUS_MAP] < 500;
