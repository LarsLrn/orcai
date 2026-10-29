import type { Area } from "react-easy-crop";

/** The side of a stored picture or logo, in pixels. */
const IMAGE_SIZE = 256;

/** The browser cannot encode WebP, so nothing was saved. */
export class WebpExportUnsupported extends Error {}

/**
 * Draws `area` of the image's first frame onto a square canvas and encodes it
 * as WebP. Re-encoding drops the file's metadata, GPS position included.
 */
export const cropToWebp = async (file: Blob, area: Area) => {
	const bitmap = await createImageBitmap(file);
	const canvas = document.createElement("canvas");
	canvas.width = IMAGE_SIZE;
	canvas.height = IMAGE_SIZE;
	const context = canvas.getContext("2d");
	if (!context) throw new WebpExportUnsupported();
	context.imageSmoothingQuality = "high";
	context.drawImage(
		bitmap,
		area.x,
		area.y,
		area.width,
		area.height,
		0,
		0,
		IMAGE_SIZE,
		IMAGE_SIZE,
	);
	bitmap.close();

	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/webp", 0.85),
	);
	// Browsers without a WebP encoder fall back to PNG.
	if (blob?.type !== "image/webp") throw new WebpExportUnsupported();
	return blob;
};
