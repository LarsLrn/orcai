import { getZedToken } from "@/lib/authz/zed-token";
import {
	catalogueCounts,
	findCatalogueEntry,
	listCatalogue,
} from "@/lib/catalogue/catalogue-browse";
import {
	installResource,
	uninstallResource,
} from "@/lib/catalogue/install-resource";
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

const install = authed.catalogue.install
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		return {
			data: yield* installResource({
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

const uninstall = authed.catalogue.uninstall
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		return {
			data: {
				changed: yield* uninstallResource({
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
	install,
	uninstall,
};
