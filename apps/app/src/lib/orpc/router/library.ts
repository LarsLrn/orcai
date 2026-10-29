import { getZedToken } from "@/lib/authz/zed-token";
import { libraryAccess } from "@/lib/library/library-access";
import {
	libraryCounts,
	libraryOverview,
	searchLibrary,
} from "@/lib/library/library-browse";
import { authed } from "@/lib/orpc/implementation/authed";

const counts = authed.library.counts.effect(function* ({ input, context }) {
	const access = yield* libraryAccess({
		userId: context.auth.user.id,
		organizationId: context.auth.session.activeOrganizationId,
		zedToken: getZedToken(context, input),
	});
	return {
		data: yield* libraryCounts(access, input),
	};
});

const overview = authed.library.overview.effect(function* ({ input, context }) {
	return {
		data: yield* libraryOverview(input, {
			userId: context.auth.user.id,
			organizationId: context.auth.session.activeOrganizationId,
			zedToken: getZedToken(context, input),
		}),
	};
});

const search = authed.library.search.effect(function* ({ input, context }) {
	const reader = {
		userId: context.auth.user.id,
		organizationId: context.auth.session.activeOrganizationId,
		zedToken: getZedToken(context, input),
	};
	return yield* searchLibrary(input, reader, yield* libraryAccess(reader));
});

export const libraryRouter = {
	counts,
	overview,
	search,
};
