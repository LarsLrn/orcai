import { extname } from "node:path/posix";
import type { AssetFileType } from "@orcai/schema";

const MAX_LENGTH = 200;

/** The last path segment without control or bidirectional formatting characters. */
const bareName = (name: string) => {
	const base =
		name
			.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "")
			.split(/[\\/]/)
			.pop()
			?.trim() ?? "";
	return /^\.*$/.test(base) ? "" : base;
};

/** At most `MAX_LENGTH` characters, keeping the extension. */
const capLength = (name: string) => {
	const characters = Array.from(name);
	if (characters.length <= MAX_LENGTH) {
		return name;
	}
	const extension = extname(name);
	const extensionLength = Array.from(extension).length;
	return extensionLength < MAX_LENGTH / 2
		? characters.slice(0, MAX_LENGTH - extensionLength).join("") + extension
		: characters.slice(0, MAX_LENGTH).join("");
};

/** The name a downloaded asset is saved under: its uploaded file name, else its title, with the file type as extension if missing. */
export const downloadName = (asset: {
	fileName: string | null;
	title: string;
	fileType: AssetFileType;
}) => {
	const uploaded = bareName(asset.fileName ?? "");
	if (uploaded !== "") {
		return capLength(
			extname(uploaded) === "" ? `${uploaded}.${asset.fileType}` : uploaded,
		);
	}
	const title = bareName(asset.title) || "file";
	return capLength(
		title.toLowerCase().endsWith(`.${asset.fileType}`)
			? title
			: `${title}.${asset.fileType}`,
	);
};
