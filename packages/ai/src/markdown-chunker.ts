import type { FileType } from "@orcai/schema";
import llamaTokenizer from "llama-tokenizer-js";

const encoding = llamaTokenizer;

export function countTokens(text: string) {
	return encoding.encode(text).length;
}

interface MarkdownNodeBase {
	title: string;
	depth: number;
	content: string;
	length: number;
	page?: number;
}

interface TextNode extends MarkdownNodeBase {
	type: "text";
}

interface ImageNode extends MarkdownNodeBase {
	type: "image";
	fileReference: string;
	fileType: FileType;
}

export type MarkdownNode = TextNode | ImageNode;

const extractFileInfoFromReference = (
	input: string,
): {
	id: string;
	extension: string | null;
} | null => {
	if (input.includes("![") && input.includes("](")) {
		const fullMatch = input.match(/\]\((image-[a-f0-9-]+)(\.(\w+))?\)/);
		if (!fullMatch) return null;

		return {
			id: fullMatch[1],
			extension: fullMatch[3] || null,
		};
	}

	const lastSegment = input.split("/").pop() || "";
	if (!lastSegment.startsWith("image-")) {
		return null;
	}

	if (lastSegment.includes(".")) {
		const dotIndex = lastSegment.lastIndexOf(".");
		return {
			id: lastSegment.substring(0, dotIndex),
			extension: lastSegment.substring(dotIndex + 1),
		};
	}

	return {
		id: lastSegment,
		extension: null,
	};
};

export function splitMarkdownAtHeaders(markdown: string, joinThreshold = 500) {
	const sections = splitMarkdownByHeaders(markdown);
	const deepest = Math.max(...sections.map((line) => line.depth));

	for (let i = deepest; i > 0; i--) {
		for (let j = 0; j < sections.length; j++) {
			if (sections[j].type === "image") continue;

			if (sections[j].depth === i && j !== 0) {
				const prev = sections[j - 1];
				if (
					prev.length + sections[j].length < joinThreshold &&
					prev.depth <= sections[j].depth &&
					prev.type === "text"
				) {
					const title = `${"#".repeat(i)} ${sections[j].title}`;
					prev.content += `\n\n${title}\n${sections[j].content}`;
					prev.length += sections[j].length + countTokens(title);
					sections.splice(j, 1);
					j--;
				}
			}
		}
	}

	return sections;
}

function splitMarkdownByHeaders(markdown: string): MarkdownNode[] {
	const sections: MarkdownNode[] = [];
	const lines = markdown.split("\n");
	let currentContent = "";
	let currentTitle = "";
	let currentDepth = 0;
	let inCodeBlock = false;

	const headerRegex = /^(#+)\s+(.+)$/;
	const imageRegex = /!\[.*?\]\(.*?\)/;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (line.startsWith("```") || line.startsWith("~~~")) {
			inCodeBlock = !inCodeBlock;
		}

		if (!inCodeBlock && imageRegex.test(line.trim())) {
			if (currentContent.trim() !== "") {
				sections.push({
					title: currentTitle,
					content: currentContent.trim(),
					depth: currentDepth,
					length: countTokens(currentContent.trim()),
					type: "text",
				});
				currentContent = "";
			}

			sections.push({
				title: currentTitle,
				content: line.trim(),
				depth: currentDepth,
				length: countTokens(line.trim()),
				type: "image",
				fileReference:
					extractFileInfoFromReference(line.match(imageRegex)?.[0] || "")?.id ||
					"",
				fileType: "unknown",
			});
			continue;
		}

		const headerMatch = line.match(headerRegex);
		if (headerMatch && !inCodeBlock) {
			if (currentContent.trim() !== "") {
				sections.push({
					title: currentTitle,
					content: currentContent.trim(),
					depth: currentDepth,
					length: countTokens(currentContent.trim()),
					type: "text",
				});
				currentContent = "";
			}

			currentDepth = headerMatch[1].length;
			currentTitle = headerMatch[2];
		} else {
			currentContent += `${line}\n`;
		}
	}

	if (currentContent.trim() !== "") {
		sections.push({
			title: currentTitle,
			content: currentContent.trim(),
			depth: currentDepth,
			length: countTokens(currentContent.trim()),
			type: "text",
		});
	}

	if (
		sections.length > 1 &&
		sections[0].title === "" &&
		sections[0].content.trim() === ""
	) {
		sections.shift();
	}

	return sections;
}
