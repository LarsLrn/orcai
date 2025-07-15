import { z } from "zod/v4";

export const fileUploadSchema = z.object({
	files: z.array(z.instanceof(File)),
});

export type FileUploadSchemaType = z.infer<typeof fileUploadSchema>;
