import type { ErrorReason, ModelCapability } from "@orcai/schema";

export type ModelUnusableReason = Extract<
	ErrorReason,
	"PROVIDER_DISABLED" | "MODEL_DEPRECATED" | "MODEL_TOOLS_UNSUPPORTED"
>;

/** The first reason a model cannot carry a tool-calling turn, or nothing when it can. */
export const modelUnusableReason = ({
	capabilities,
	isDeprecated,
	providerEnabled,
}: {
	capabilities: readonly ModelCapability[];
	isDeprecated: boolean;
	providerEnabled: boolean;
}): ModelUnusableReason | undefined => {
	if (!providerEnabled) return "PROVIDER_DISABLED";
	if (isDeprecated) return "MODEL_DEPRECATED";
	if (!capabilities.includes("tool-calling")) return "MODEL_TOOLS_UNSUPPORTED";
	return undefined;
};
