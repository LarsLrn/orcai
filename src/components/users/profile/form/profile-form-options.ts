import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";
import { type User, userUpdateSchema } from "@/lib/orpc/schemas/user";

const defaultValues = (user: User): z.input<typeof userUpdateSchema> => ({
	name: user.name,
});

export const profileFormOptions = (user: User) =>
	formOptions({
		defaultValues: defaultValues(user),
		validators: {
			onChange: userUpdateSchema,
		},
	});
