// Implementation taken from a PR suggestion on the mastra Discord server.

import llamaTokenizer from "llama-tokenizer-js";
import type { FileType } from "@/lib/s3/schema/file-schema";
import { extractFileInfoFromReference } from "./utils";

const encoding = llamaTokenizer;

export function countTokens(text: string) {
	return encoding.encode(text).length;
}

interface MarkdownNodeBase {
	title: string;
	depth: number;
	content: string;
	length: number;
}

interface TextNode extends MarkdownNodeBase {
	type: "text";
}

interface ImageNode extends MarkdownNodeBase {
	type: "image";
	fileReference: string; // This property only exists for images
	fileType: FileType;
}

export type MarkdownNode = TextNode | ImageNode;

export function splitMarkdownAtHeaders(markdown: string, joinThreshold = 500) {
	const sections = splitMarkdownByHeaders(markdown);

	const deepest = Math.max(...sections.map((line) => line.depth));

	for (let i = deepest; i > 0; i--) {
		for (let j = 0; j < sections.length; j++) {
			// Skip image chunks during merging
			if (sections[j].type === "image") continue;

			if (sections[j].depth === i && j !== 0) {
				const prev = sections[j - 1];
				if (
					prev.length + sections[j].length < joinThreshold &&
					prev.depth <= sections[j].depth &&
					prev.type === "text" // Ensure merging only happens with text chunks
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

		// Check for code block delimiters
		if (line.startsWith("```") || line.startsWith("~~~")) {
			inCodeBlock = !inCodeBlock;
		}

		// Check for image placeholders
		if (!inCodeBlock && imageRegex.test(line.trim())) {
			// First, save the current content if there is any
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

			// Then add the image as its own chunk
			sections.push({
				title: currentTitle,
				content: line.trim(),
				depth: currentDepth,
				length: countTokens(line.trim()),
				type: "image",
				fileReference:
					extractFileInfoFromReference(line.match(imageRegex)?.[0] || "")?.id ||
					"", // Extract the image reference
				fileType: "unknown",
			});

			// Continue to next line without adding this to currentContent
			continue;
		}

		// Process headers as before
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
			// Only add non-image lines to current content
			currentContent += `${line}\n`;
		}
	}

	// Add the last section if there's any remaining content
	if (currentContent.trim() !== "") {
		sections.push({
			title: currentTitle,
			content: currentContent.trim(),
			depth: currentDepth,
			length: countTokens(currentContent.trim()),
			type: "text",
		});
	}

	// If there was no preamble, and there were headers, remove the initial empty preamble.
	if (
		sections.length > 1 &&
		sections[0].title === "" &&
		sections[0].content.trim() === ""
	) {
		sections.shift();
	}

	return sections;
}
