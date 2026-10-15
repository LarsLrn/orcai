import { ORPCError } from "@orpc/client";
import { notFound } from "@tanstack/react-router";
import type { z } from "zod/v4";

/** A path id that does not parse names no entity, so it renders as not found. */
export const parseParam = <Schema extends z.ZodType>(
	schema: Schema,
	value: string,
): z.output<Schema> => {
	const result = schema.safeParse(value);

	if (!result.success) {
		throw notFound();
	}

	return result.data;
};

/** Hides whether an entity the viewer may not see exists, like the route guards. */
export const orNotFound = async <T>(promise: Promise<T>): Promise<T> => {
	try {
		return await promise;
	} catch (error) {
		if (
			error instanceof ORPCError &&
			(error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
		) {
			throw notFound();
		}

		throw error;
	}
};
