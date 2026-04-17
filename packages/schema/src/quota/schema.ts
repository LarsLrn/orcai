import type {
	QuotaLedgerId,
	QuotaPeriodId,
	QuotaPoolAuditLogId,
	QuotaPoolGroupAssignmentId,
	QuotaPoolId,
	QuotaUsageEventId,
} from "@orcai/core";
import { createUuidIdSchema } from "../shared";

// Stub entrypoint for the quota resource migration.
export const quotaPoolIdSchema = createUuidIdSchema<QuotaPoolId>();
export const quotaPoolGroupAssignmentIdSchema =
	createUuidIdSchema<QuotaPoolGroupAssignmentId>();
export const quotaPeriodIdSchema = createUuidIdSchema<QuotaPeriodId>();
export const quotaLedgerIdSchema = createUuidIdSchema<QuotaLedgerId>();
export const quotaUsageEventIdSchema = createUuidIdSchema<QuotaUsageEventId>();
export const quotaPoolAuditLogIdSchema =
	createUuidIdSchema<QuotaPoolAuditLogId>();
