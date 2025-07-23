import { keepPreviousData, type skipToken } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
import type { OrpcInputs } from "../orpc/contracts";

export const storageQueryOptions = {
	createUploadUrls: () => {
		return orpc.storage.createUploadUrls.mutationOptions();
	},

	createDownloadUrl: ({
		input,
	}: {
		input: OrpcInputs["storage"]["createDownloadUrl"] | typeof skipToken;
	}) => {
		return orpc.storage.createDownloadUrl.queryOptions({
			input,
			queryKey: orpc.storage.createDownloadUrl.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},
} as const;
