import { readRevision } from "@/lib/authz/zed-token";
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
import { requireOrganization } from "@/lib/orpc/middlewares/organization";

const list = authed.catalogue.list
	.use(requireOrganization())
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
	.use(requireOrganization())
	.effect(function* ({ input, context }) {
		return {
			data: yield* findCatalogueEntry(
				input.entry,
				context.auth.session.activeOrganizationId,
			),
		};
	});

const add = authed.catalogue.add.use(requireOrganization()).effect(function* ({
	input,
	context,
}) {
	return {
		data: yield* addResource({
			resource: input.entry,
			organizationId: context.auth.session.activeOrganizationId,
			withBlocks: input.withBlocks,
			actor: {
				userId: context.auth.user.id,
				zedToken: readRevision(context, input),
			},
		}),
	};
});

const addBlocks = authed.catalogue.addBlocks
	.use(requireOrganization())
	.effect(function* ({ input, context }) {
		return {
			data: {
				addedBlocks: yield* addBotBlocks({
					botId: input.botId,
					organizationId: context.auth.session.activeOrganizationId,
					actor: {
						userId: context.auth.user.id,
						zedToken: readRevision(context, input),
					},
				}),
			},
		};
	});

const remove = authed.catalogue.remove
	.use(requireOrganization())
	.effect(function* ({ input, context }) {
		return {
			data: {
				changed: yield* removeResource({
					resource: input.entry,
					organizationId: context.auth.session.activeOrganizationId,
					actor: {
						userId: context.auth.user.id,
						zedToken: readRevision(context, input),
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
