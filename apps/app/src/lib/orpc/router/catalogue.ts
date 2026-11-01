import { getZedToken } from "@/lib/authz/zed-token";
import {
	addBotBlocks,
	addResource,
	removeResource,
} from "@/lib/catalogue/add-resource";
import {
	catalogueCounts,
	findCatalogueEntry,
	listCatalogue,
} from "@/lib/catalogue/catalogue-browse";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";

const list = authed.catalogue.list
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		return yield* listCatalogue(
			input,
			context.auth.session.activeOrganizationId,
		);
	});

const counts = authed.catalogue.counts.effect(function* ({ input }) {
	return {
		data: yield* catalogueCounts(input.search),
	};
});

const find = authed.catalogue.find
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		return {
			data: yield* findCatalogueEntry(
				input.entry,
				context.auth.session.activeOrganizationId,
			),
		};
	});

const add = authed.catalogue.add
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		return {
			data: yield* addResource({
				resource: input.entry,
				organizationId: context.auth.session.activeOrganizationId,
				withBlocks: input.withBlocks,
				actor: {
					userId: context.auth.user.id,
					zedToken: getZedToken(context, input),
				},
			}),
		};
	});

const addBlocks = authed.catalogue.addBlocks
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		return {
			data: {
				addedBlocks: yield* addBotBlocks({
					botId: input.botId,
					organizationId: context.auth.session.activeOrganizationId,
					actor: {
						userId: context.auth.user.id,
						zedToken: getZedToken(context, input),
					},
				}),
			},
		};
	});

const remove = authed.catalogue.remove
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		return {
			data: {
				changed: yield* removeResource({
					resource: input.entry,
					organizationId: context.auth.session.activeOrganizationId,
					actor: {
						userId: context.auth.user.id,
						zedToken: getZedToken(context, input),
					},
				}),
			},
		};
	});

export const catalogueRouter = {
	list,
	counts,
	find,
	add,
	addBlocks,
	remove,
};
