/** Images below this many pixels are icons and bullets, not figures. */
const MIN_FIGURE_PIXELS = 40_000;

/** Whether an extracted image is too small to be a figure; one of unknown size is kept. */
export const belowFigureSize = (image: {
	readonly width?: unknown;
	readonly height?: unknown;
}) =>
	typeof image.width === "number" &&
	typeof image.height === "number" &&
	image.width * image.height < MIN_FIGURE_PIXELS;
