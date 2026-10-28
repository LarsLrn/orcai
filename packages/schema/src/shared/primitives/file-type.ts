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

const IMAGE_FILE_TYPES = new Set<string>([
	"jpeg",
	"jpg",
	"png",
	"gif",
	"webp",
] satisfies FileType[]);

/** Whether a file of this type is a single image. */
export const isImageFileType = (fileType: string): fileType is FileType =>
	IMAGE_FILE_TYPES.has(fileType);

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
