import type { PrepareAgainRefused } from "@orcai/preparation";
import * as AppErrors from "@/lib/effect/utils/errors";

/** The client's error for a request to prepare an asset again that admitted nothing. */
export const prepareAgainError = ({ reason }: PrepareAgainRefused) => {
	switch (reason) {
		case "not_found":
			return new AppErrors.NotFoundError({
				reason: "ASSET_NOT_FOUND",
				message: "Asset not found",
			});
		case "not_attached":
			return new AppErrors.NotFoundError({
				reason: "ASSET_NOT_ATTACHED",
				message: "Asset not attached to this repository",
			});
		case "preparing":
			return new AppErrors.BadRequestError({
				reason: "ASSET_STILL_PREPARING",
				message: "The asset is still being prepared",
			});
		case "unhelpful":
			return new AppErrors.BadRequestError({
				reason: "ASSET_PREPARING_AGAIN_UNHELPFUL",
				message: "Preparing the asset again would fail the same way",
			});
	}
};
