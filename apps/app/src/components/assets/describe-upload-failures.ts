import type { UploadFailure } from "@/components/assets/use-asset-intake";
import { m } from "@/paraglide/messages";

/** The first failure's reason, and how many more files failed. */
export const describeUploadFailures = (failures: UploadFailure[]) => {
	const [first, ...rest] = failures;
	if (!first) return undefined;
	if (rest.length === 0) return first.message;

	return `${first.message} ${m.assets_upload_failures_more({
		count: rest.length,
	})}`;
};
