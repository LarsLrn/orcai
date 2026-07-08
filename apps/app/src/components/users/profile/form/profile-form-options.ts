import { type User, userMutableFieldsSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";

const defaultValues = (
	user: Omit<User, "preferences">,
): z.input<typeof userMutableFieldsSchema> => ({
	name: user.name,
});

export const profileFormOptions = (user: Omit<User, "preferences">) =>
	formOptions({
		defaultValues: defaultValues(user),
		validators: {
			onChange: userMutableFieldsSchema,
		},
	});
