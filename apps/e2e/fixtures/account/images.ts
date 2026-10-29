import { expect, type Locator, type Page } from "@playwright/test";
import type { ApiClient } from "../api";
import { message } from "../messages";

/** A 64x48 crimson PNG, wider than tall so the crop has work to do. */
export const PNG = {
	name: "picture.png",
	mimeType: "image/png",
	buffer: Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAAVUlEQVR4nO3PQQ3AIADAQEADcvCvAjETweOypKegnXef8WdLB7xqQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtA+wBWlwGMHgGN8gAAAABJRU5ErkJggg==",
		"base64",
	),
};

/** A 32x32 GIF animating from a red frame to a blue one. */
export const ANIMATED_GIF = {
	name: "animated.gif",
	mimeType: "image/gif",
	buffer: Buffer.from(
		"R0lGODlhIAAgAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQAFAAAACwAAAAAIAAgAAAINQABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDihxJsqTJkyhTqlzJUmRAACH5BAEUAAEALAAAAAAgACAAgQAA/wAAAAAAAAAAAAg1AAEIHEiwoMGDCBMqXMiwocOHECNKnEixosWLGDNq3Mixo8ePIEOKHEmypMmTKFOqXMlSZEAAOw==",
		"base64",
	),
};

type ImageFile = typeof PNG;

/**
 * Opens the image dialog with `change`, drops `file` into it, saves the crop
 * and waits for the dialog to close.
 */
export const saveImageThroughDialog = async (
	page: Page,
	change: Locator,
	file: ImageFile,
): Promise<void> => {
	await change.click();
	const dialog = page.getByRole("dialog");
	await dialog.locator('input[type="file"]').setInputFiles(file);
	await expect(
		dialog.getByRole("slider", {
			name: message("images_dialog_zoom_label"),
		}),
	).toBeVisible();
	const save = dialog.getByRole("button", {
		name: message("common_save_button"),
	});
	await expect(save).toBeEnabled();
	await save.click();
	await expect(dialog).toBeHidden();
};

/** The size and centre pixel of the image at `src`, decoded in the page. */
export const centrePixel = (page: Page, src: string) =>
	page.evaluate(async (url) => {
		// The e2e package compiles without the DOM library.
		const browser = globalThis as unknown as {
			createImageBitmap: (blob: unknown) => Promise<{
				width: number;
				height: number;
			}>;
			OffscreenCanvas: new (
				width: number,
				height: number,
			) => {
				getContext: (kind: "2d") => {
					drawImage: (image: unknown, x: number, y: number) => void;
					getImageData: (
						x: number,
						y: number,
						width: number,
						height: number,
					) => {
						data: ArrayLike<number>;
					};
				} | null;
			};
		};
		const bitmap = await browser.createImageBitmap(
			await (await fetch(url)).blob(),
		);
		const context = new browser.OffscreenCanvas(
			bitmap.width,
			bitmap.height,
		).getContext("2d");
		if (!context) throw new Error("no 2d context");
		context.drawImage(bitmap, 0, 0);
		const { data } = context.getImageData(
			bitmap.width / 2,
			bitmap.height / 2,
			1,
			1,
		);
		return {
			width: bitmap.width,
			height: bitmap.height,
			red: data[0] ?? 0,
			green: data[1] ?? 0,
			blue: data[2] ?? 0,
		};
	}, src);

/** A 1x1 lossless WebP, as the crop dialog would upload it. */
const WEBP = Buffer.from(
	"UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==",
	"base64",
);

/** Uploads a picture for the caller and sets it, without the dialog; answers its path. */
export const setPictureThroughApi = async (api: ApiClient): Promise<string> => {
	const {
		data: [target],
	} = await api.storage.createUploadUrls({
		route: "profileImage",
		files: [
			{
				name: "picture.webp",
				size: WEBP.byteLength,
				type: "image/webp",
			},
		],
	});
	if (target?.mode !== "single") throw new Error("expected a single upload");
	const response = await fetch(target.signedUrl, {
		method: "PUT",
		headers: target.headers,
		body: WEBP,
	});
	expect(response.ok).toBe(true);
	const { data } = await api.user.setImage({
		file: target.file,
	});
	return data.image;
};
