import { z } from "zod/v4";

const email = z.email();

const username = z.string().min(3).nullish();

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Better Auth counts UTF-16 code units, zod's max counts code points.
const password = z
	.string()
	.min(PASSWORD_MIN_LENGTH)
	.superRefine((value, ctx) => {
		if (value.length > PASSWORD_MAX_LENGTH)
			ctx.addIssue({
				code: "too_big",
				origin: "string",
				maximum: PASSWORD_MAX_LENGTH,
				inclusive: true,
				input: value,
			});
	});

const currentPassword = z.string().min(1);

const name = z.string().min(3).max(100);

export const sharedSchemas = {
	email,
	username,
	password,
	currentPassword,
	name,
};
