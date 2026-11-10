import type { ExtractedImage, ExtractionResult } from "@kreuzberg/node";
import type { ExpandedMetadata } from "../kreuzberg-expanded-types";

/** How far an image's aspect ratio may differ from its page's and still be the whole page. */
const ASPECT_TOLERANCE = 0.03;
/** The share of the page's width and height an image's bounding box must cover. */
const MIN_COVERAGE = 0.95;
/** A page is 72 points to the inch, and a scan has at least one pixel per point. */
const MIN_PIXELS_PER_POINT = 1;

const coversPage = (
	image: ExtractedImage,
	[pageWidth, pageHeight]: readonly [
		number,
		number,
	],
) => {
	const box = image.boundingBox;
	if (box) {
		return (
			Math.abs(box.x1 - box.x0) >= MIN_COVERAGE * pageWidth &&
			Math.abs(box.y1 - box.y0) >= MIN_COVERAGE * pageHeight
		);
	}
	const { width, height } = image;
	if (typeof width !== "number" || typeof height !== "number" || height <= 0)
		return false;
	const pageAspect = pageWidth / pageHeight;
	return (
		Math.abs(width / height - pageAspect) <= ASPECT_TOLERANCE * pageAspect &&
		width >= MIN_PIXELS_PER_POINT * pageWidth
	);
};

/**
 * Whether `image` is the scan of a whole page that has no text of its own, so
 * the page's text came from OCR and the image would index that page a second
 * time. False whenever the page or its size is unknown.
 */
export const isPageScan = (result: ExtractionResult, image: ExtractedImage) => {
	if (!image.ocrResult?.content.trim()) return false;
	const page = result.pages?.find(
		({ pageNumber }) => pageNumber === image.pageNumber,
	);
	if (!page || page.content.trim()) return false;
	const dimensions = (result.metadata as ExpandedMetadata).pages?.pages?.find(
		({ number }) => number === image.pageNumber,
	)?.dimensions;
	return dimensions ? coversPage(image, dimensions) : false;
};

/**
 * The pages of `result` with the text OCR read on each scanned page as its
 * text, which the page has none of, so passages from that text find their page.
 */
export const withScannedPageTexts = (
	result: ExtractionResult,
): ExtractionResult => {
	const scans = new Map<number, string>();
	for (const image of result.images ?? []) {
		if (typeof image.pageNumber === "number" && isPageScan(result, image))
			scans.set(image.pageNumber, image.ocrResult?.content ?? "");
	}
	if (scans.size === 0) return result;
	return {
		...result,
		pages: result.pages?.map((page) => {
			const text = scans.get(page.pageNumber);
			return text
				? {
						...page,
						content: text,
					}
				: page;
		}),
	};
};
