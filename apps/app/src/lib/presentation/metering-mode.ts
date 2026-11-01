import type { ProviderMeteringMode } from "@orcai/schema";
import { m } from "@/paraglide/messages";

const meteringModeLabels: Record<ProviderMeteringMode, () => string> = {
	tokens: m.providers_metering_mode_tokens_label,
	requests: m.providers_metering_mode_requests_label,
};

const meteringUnits: Record<
	ProviderMeteringMode,
	(inputs: { count: number }) => string
> = {
	tokens: m.quota_pools_unit_tokens,
	requests: m.quota_pools_unit_requests,
};

export const getMeteringModeLabel = (mode: ProviderMeteringMode) =>
	meteringModeLabels[mode]();

/** The unit after an amount, such as "tokens" in "1,200 tokens". */
export const getMeteringUnit = (mode: ProviderMeteringMode, count: number) =>
	meteringUnits[mode]({
		count,
	});
