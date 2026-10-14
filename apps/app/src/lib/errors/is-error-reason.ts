import { ERROR_REASONS, type ErrorReason } from "@orcai/schema";

const REASONS = new Set<string>(ERROR_REASONS);

export const isErrorReason = (value: unknown): value is ErrorReason =>
	typeof value === "string" && REASONS.has(value);
