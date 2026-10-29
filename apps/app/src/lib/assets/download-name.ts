import type { AssetFileType } from "@orcai/schema";

/** The name a downloaded asset is saved under: its title, with the file type as extension if missing. */
export const downloadName = (title: string, fileType: AssetFileType) =>
	title.toLowerCase().endsWith(`.${fileType}`) ? title : `${title}.${fileType}`;
