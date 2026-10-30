import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { downloadImage } from "./download-image";

const download = (dataUrl: string) => {
	let clicked: HTMLAnchorElement | undefined;
	const click = spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
		function (this: HTMLAnchorElement) {
			clicked = this;
		},
	);
	downloadImage(dataUrl);
	click.mockRestore();
	return clicked;
};

describe("downloadImage", () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	test("downloads the data URL as a png file", () => {
		const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
		const link = download(dataUrl);

		expect(link?.href).toBe(dataUrl);
		expect(link?.download).toBe("generated-image.png");
	});

	test.each([
		[
			"image/jpeg",
			"jpg",
		],
		[
			"image/webp",
			"webp",
		],
	])("names %s files .%s", (mediaType, extension) => {
		const link = download(`data:${mediaType};base64,AAAA`);

		expect(link?.download).toBe(`generated-image.${extension}`);
	});
});
