import {
	findLatestDataExport,
	requestDataExport,
} from "@/lib/data-export/data-export";
import { authed } from "@/lib/orpc/implementation/authed";

const latestDataExport = authed.dataExport.latest.effect(function* ({
	context,
}) {
	return {
		data: (yield* findLatestDataExport(context.auth.user.id)) ?? null,
	};
});

const createDataExport = authed.dataExport.request.effect(function* ({
	context,
}) {
	return {
		data: yield* requestDataExport(context.auth.user.id),
	};
});

export const dataExportRouter = {
	latest: latestDataExport,
	request: createDataExport,
};
