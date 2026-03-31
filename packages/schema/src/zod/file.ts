import { z } from "zod/v4";

export const fileTypeSchema = z.enum([
	"pdf",
	"jpeg",
	"jpg",
	"png",
	"gif",
	"webp",
	"docx",
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
