import { z } from "zod/v4";

const email = z.email();

const username = z.string().min(3).nullish();

const password = z.string().min(8);

const name = z.string().min(3).max(100);

export const sharedSchemas = {
	email,
	username,
	password,
	name,
};
