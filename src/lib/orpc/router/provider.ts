import { ORPCError } from "@orpc/server";
import { eq, getColumns } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { dbSchema } from "@/db/schema";
import { authed } from "@/lib/orpc/implementation/authed";

export const listProviders = authed.provider.list.handler(async () => {
	const providers = await db
		.select({ ...getColumns(dbSchema.provider) })
		.from(dbSchema.provider);

	return { data: providers };
});

export const findProvider = authed.provider.find
	/* .use(
    checkPermissionMiddleware,
    (input) =>
      ({
        entityId: input.id,
        action: "read",
        entityType: "organization",
      }) satisfies CheckPermissionInput,
  ) */
	.handler(async ({ input }) => {
		const [provider] = await db
			.select({ ...getColumns(dbSchema.provider) })
			.from(dbSchema.provider)
			.where(eq(dbSchema.provider.slug, input.slug));

		if (!provider) {
			throw new ORPCError("NOT_FOUND", {
				message: "Provider not found",
			});
		}

		return { data: provider };
	});
