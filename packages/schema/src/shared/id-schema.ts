import { z } from "zod/v4";

export function createUuidIdSchema<TId extends string>() {
	return z.uuidv4().transform((value) => value as TId);
}
