import { m } from "@/paraglide/messages";

const extensions: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
};

const extensionOf = (dataUrl: string) => {
	const mediaType = /^data:([^;,]+)/.exec(dataUrl)?.[1];
	return (mediaType && extensions[mediaType]) ?? "png";
};

/** Saves a `data:` URL, as the AI SDK supplies generated images, without decoding it. */
export const downloadImage = (dataUrl: string) => {
	const link = document.createElement("a");
	link.href = dataUrl;
	link.download = `${m.chat_image_part_file_name()}.${extensionOf(dataUrl)}`;
	document.body.append(link);
	link.click();
	link.remove();
};
