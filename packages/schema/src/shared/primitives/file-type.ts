import { z } from "zod/v4";

export const fileTypeSchema = z.enum([
	"pdf",
	"jpeg",
	"jpg",
	"png",
	"gif",
	"webp",
	"doc",
	"docx",
	"xls",
	"xlsx",
	"ppt",
	"pptx",
	"txt",
	"csv",
	"mp3",
	"wav",
	"mp4",
	"mov",
	"md",
	"unknown",
]);

export type FileType = z.infer<typeof fileTypeSchema>;

/** The file types an asset upload accepts. */
export const ASSET_FILE_TYPES = [
	"pdf",
	"jpeg",
	"jpg",
	"png",
	"gif",
	"webp",
	"doc",
	"docx",
	"xls",
	"xlsx",
	"ppt",
	"pptx",
	"txt",
	"csv",
	"md",
] as const satisfies readonly FileType[];

export const assetFileTypeSchema = z.enum(ASSET_FILE_TYPES);

export type AssetFileType = z.infer<typeof assetFileTypeSchema>;
