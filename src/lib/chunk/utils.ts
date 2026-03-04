import { v4 as uuidv4 } from "uuid";

/**
 * Extracts embedded base64 images from markdown content, replacing them with placeholders.
 *
 * @param markdown - The original markdown content with potentially embedded images
 * @returns An object containing the modified markdown text and an array of extracted images
 */
export function extractMarkdownImages(markdown: string): {
	modifiedMarkdown: string;
	extractedImages: Array<{
		placeholder: string;
		imageData: string;
		alt: string;
		mimeType: string;
	}>;
} {
	const extractedImages: Array<{
		placeholder: string;
		imageData: string;
		alt: string;
		mimeType: string;
	}> = [];

	// Regular expression to match markdown image syntax with base64 data
	// Captures: ![alt text](data:image/png;base64,BASE64DATA)
	const imageRegex = /!\[(.*?)\]\(data:(image\/[\w+]+);base64,(.*?)\)/g;

	// Replace each image with a placeholder and store the image data
	const modifiedMarkdown = markdown.replace(
		imageRegex,
		(_match, alt, mimeType, imageData) => {
			const imageId = uuidv4();
			const placeholder = `![${alt}](image-${imageId})`;

			extractedImages.push({
				placeholder: `image-${imageId}`,
				imageData,
				alt,
				mimeType,
			});

			return placeholder;
		},
	);

	return {
		modifiedMarkdown,
		extractedImages,
	};
}

export const extractFileInfoFromReference = (
	input: string,
): {
	id: string;
	extension: string | null;
} | null => {
	// For markdown image syntax: ![Alt text](image-guid.extension)
	if (input.includes("![") && input.includes("](")) {
		// Extract both the ID and extension if present
		const fullMatch = input.match(/\]\((image-[a-f0-9-]+)(\.(\w+))?\)/);
		if (!fullMatch) return null;

		const id = fullMatch[1];
		const extension = fullMatch[3] || null;
		return {
			id,
			extension,
		};
	}

	// For file paths: path/to/image-guid.extension
	const lastSegment = input.split("/").pop() || "";
	if (!lastSegment.startsWith("image-")) {
		return null;
	}

	if (lastSegment.includes(".")) {
		const dotIndex = lastSegment.lastIndexOf(".");
		const id = lastSegment.substring(0, dotIndex);
		const extension = lastSegment.substring(dotIndex + 1);
		return {
			id,
			extension,
		};
	}
	// No extension present
	return {
		id: lastSegment,
		extension: null,
	};
};
