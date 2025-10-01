import type { Size } from "@docling/docling-core";

/**
 * Validates if an image meets minimum resolution requirements
 * @param imageBuffer The image buffer to check
 * @returns An object containing validation result and metadata
 */
export function validateImageResolution(size: Size, upscaleFactor = 1) {
	// Define minimum resolution requirements
	const MIN_IMAGE_WIDTH = 100 * upscaleFactor; // pixels
	const MIN_IMAGE_HEIGHT = 100 * upscaleFactor; // pixels
	const MIN_SINGLE_DIMENSION = 50 * upscaleFactor; // pixels

	try {
		const width = size.width || 0;
		const height = size.height || 0;

		/* Images have to be at least 20 pixels in any dimension
    and at least 100 pixels in either width or height
    to be considered valid
    MIN_SINGLE_DIMENSION ensures very narrow or flat images are not accepted */
		const isValidResolution =
			(width >= MIN_IMAGE_WIDTH || height >= MIN_IMAGE_HEIGHT) &&
			width > MIN_SINGLE_DIMENSION &&
			height > MIN_SINGLE_DIMENSION;

		return {
			isValid: isValidResolution,
		};
	} catch (error) {
		return {
			isValid: false,
			width: 0,
			height: 0,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
