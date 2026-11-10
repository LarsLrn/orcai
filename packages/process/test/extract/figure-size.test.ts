import { expect, test } from "bun:test";
import { belowFigureSize } from "../../src/extract/figure-size";

test("an image under 40,000 pixels is too small to be a figure, whatever its shape", () => {
	expect(
		belowFigureSize({
			width: 199,
			height: 200,
		}),
	).toBe(true);
	expect(
		belowFigureSize({
			width: 200,
			height: 200,
		}),
	).toBe(false);
	expect(
		belowFigureSize({
			width: 1600,
			height: 120,
		}),
	).toBe(false);
	expect(belowFigureSize({})).toBe(false);
});
