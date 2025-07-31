import type { CustomUIMessage } from "@/lib/ai/tools";

interface PartGroup {
	reasoning: any[];
	tools: any[];
	files: any[];
	textParts: any[];
	otherParts: any[];
}

/**
 * Sorts and groups message parts according to AI SDK v5 streaming patterns.
 *
 * In AI SDK v5:
 * - Empty text parts are created initially during streaming
 * - Reasoning comes after the initial text part
 * - Multiple text parts may exist when tools are called
 * - Only the last text part typically contains the final response
 * - Tool calls and results should be shown in sequence
 *
 * This function ensures logical ordering: reasoning (unified) → tools → files → final text
 */
export const sortMessageParts = (parts: CustomUIMessage["parts"]): any[] => {
	if (!parts || parts.length === 0) return [];

	const groups: PartGroup = {
		reasoning: [],
		tools: [],
		files: [],
		textParts: [],
		otherParts: [],
	};

	// Group parts by type and track order for tools
	parts.forEach((part, index) => {
		if (part.type === "reasoning") {
			groups.reasoning.push({ ...part, originalIndex: index });
		} else if (part.type.startsWith("tool-")) {
			groups.tools.push({ ...part, originalIndex: index });
		} else if (part.type === "file") {
			groups.files.push({ ...part, originalIndex: index });
		} else if (part.type === "text") {
			groups.textParts.push({ ...part, originalIndex: index });
		} else {
			groups.otherParts.push({ ...part, originalIndex: index });
		}
	});

	// Sort tools by original order to maintain tool call → result sequence
	groups.tools.sort((a, b) => a.originalIndex - b.originalIndex);

	// Find the final text part (last non-empty text, or just last text if all empty)
	let finalTextPart = null;

	// First try to find the last text part with actual content
	for (let i = groups.textParts.length - 1; i >= 0; i--) {
		const textPart = groups.textParts[i];
		if (textPart.text?.trim()) {
			finalTextPart = textPart;
			break;
		}
	}

	// If no text with content, use the last text part
	if (!finalTextPart && groups.textParts.length > 0) {
		finalTextPart = groups.textParts[groups.textParts.length - 1];
	}

	// Remove the final text part from the textParts array to avoid duplication
	if (finalTextPart) {
		groups.textParts = groups.textParts.filter(
			(part) => part.originalIndex !== finalTextPart.originalIndex,
		);
	}

	// Assemble in logical order - combine all reasoning into a single virtual part
	const sortedParts: any[] = [];

	// Add unified reasoning if any exist
	if (groups.reasoning.length > 0) {
		sortedParts.push({
			type: "unified-reasoning",
			reasoningParts: groups.reasoning.map(
				({ originalIndex, ...part }) => part,
			),
		});
	}

	// Add the rest in order
	sortedParts.push(
		...groups.tools, // Tool calls/results in sequence
		...groups.files, // Any generated files
		...groups.otherParts, // Other content types
		...(finalTextPart ? [finalTextPart] : []), // Final text response last
	);

	// Remove the originalIndex property we added for sorting (except for unified reasoning)
	return sortedParts.map((part) => {
		if (part.type === "unified-reasoning") {
			return part; // Keep as-is for unified reasoning
		}
		const { originalIndex: _, ...cleanPart } = part;
		return cleanPart;
	});
};
