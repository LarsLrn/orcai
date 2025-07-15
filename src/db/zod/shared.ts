import { z } from "zod/v4";

const email = z.string().email({
	message: "Invalid email address.",
});

const username = z
	.string()
	.min(3, {
		message: "Username must be at least 3 characters.",
	})
	.nullish();

const password = z.string().min(8, {
	message: "Password must be at least 8 characters.",
});

const name = z
	.string()
	.min(3, {
		message: "Name must be at least 3 characters.",
	})
	.max(100, {
		message: "Name must be at most 100 characters.",
	});

export const sharedSchemas = {
	email,
	username,
	password,
	name,
};
