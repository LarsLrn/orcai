import z from "zod/v4";

export const fileTypeSchema = z.enum([
	"pdf",
	"jpeg",
	"png",
	"docx",
	"pptx",
	"md",
	"unknown",
]);

export type FileType = z.infer<typeof fileTypeSchema>;
