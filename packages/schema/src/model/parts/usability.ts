import type { ErrorReason } from "../../shared/error-reason";
import type { ModelCapability } from "./capabilities";

const required = {
	turn: {
		capability: "tool-calling",
		reason: "MODEL_TOOLS_UNSUPPORTED",
	},
	text: {
		capability: "text",
		reason: "MODEL_TEXT_UNSUPPORTED",
	},
} as const satisfies Record<
	string,
	{
		capability: ModelCapability;
		reason: ErrorReason;
	}
>;

/** What a model is used for: tool-calling turns, or single text calls such as titles. */
export type ModelUse = keyof typeof required;

export type ModelUnusableReason<Use extends ModelUse = ModelUse> =
	| "PROVIDER_DISABLED"
	| "MODEL_DEPRECATED"
	| (typeof required)[Use]["reason"];

/** The first reason a model cannot serve `use`, or nothing when it can. */
export const modelUnusableReason = <Use extends ModelUse>(
	{
		capabilities,
		isDeprecated,
		providerEnabled,
	}: {
		capabilities: readonly ModelCapability[];
		isDeprecated: boolean;
		providerEnabled: boolean;
	},
	use: Use,
): ModelUnusableReason<Use> | undefined => {
	if (!providerEnabled) return "PROVIDER_DISABLED";
	if (isDeprecated) return "MODEL_DEPRECATED";
	const { capability, reason } = required[use];
	return capabilities.includes(capability) ? undefined : reason;
};
