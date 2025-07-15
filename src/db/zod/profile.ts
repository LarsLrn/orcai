import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { user } from "@/db/schema/auth";

export const userInsertSchema = createInsertSchema(user);

export const userUpdateSchema = createUpdateSchema(user);

export const userDeleteSchema = z.object({
	refs: z.array(userUpdateSchema.pick({ id: true })),
});

export type UserInsertSchemaType = z.infer<typeof userInsertSchema>;
export type UserUpdateSchemaType = z.infer<typeof userUpdateSchema>;
export type UserDeleteSchemaType = z.infer<typeof userDeleteSchema>;
