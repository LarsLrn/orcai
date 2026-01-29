import { ORPCError } from "@orpc/server";
import { eq, getTableColumns } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { providerTable } from "@/db/schema/model";
import { authed } from "@/lib/orpc/implementation/authed";

export const listProviders = authed.provider.list.handler(async () => {
	const providers = await db
		.select({ ...getTableColumns(providerTable) })
		.from(providerTable);

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
			.select({ ...getTableColumns(providerTable) })
			.from(providerTable)
			.where(eq(providerTable.slug, input.slug));

		if (!provider) {
			throw new ORPCError("NOT_FOUND", {
				message: "Provider not found",
			});
		}

		return { data: provider };
	});
