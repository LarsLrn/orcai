import type { ToolLoading } from "@orcai/ai";
import type { JSONValue } from "ai";
import {
	type AssistantToolName,
	type CapabilitySet,
	isToolOffered,
} from "./groups";

/**
 * The model output of a result that makes `tools` callable. Where tools are
 * deferred it also references those this user may use now, which loads them;
 * stored outputs replay with the lists of their time.
 */
export const toolLoadingOutput = (
	output: JSONValue,
	tools: readonly AssistantToolName[],
	{
		toolLoading,
		capabilities,
	}: {
		toolLoading: ToolLoading;
		capabilities: CapabilitySet;
	},
) => {
	const referenced =
		toolLoading.type === "references"
			? tools.filter((name) => isToolOffered(name, capabilities))
			: [];

	return toolLoading.type === "references" && referenced.length > 0
		? {
				type: "content" as const,
				value: [
					{
						type: "text" as const,
						text: JSON.stringify(output),
					},
					...referenced.map(toolLoading.reference),
				],
			}
		: {
				type: "json" as const,
				value: output,
			};
};
