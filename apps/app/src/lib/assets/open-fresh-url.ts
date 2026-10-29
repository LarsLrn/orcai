import { toast } from "sonner";
import { m } from "@/paraglide/messages";

/** What a query's `refetch` returns: a failed refetch keeps the last data, so `isError` decides. */
export type RefetchedUrl = {
	isError: boolean;
	data?: {
		url: string;
	};
};

// Presigned URLs expire, so a file opens through a fresh one. The tab opens
// synchronously to keep the click's popup permission.
export const openFreshUrl = async (refetch: () => Promise<RefetchedUrl>) => {
	const tab = window.open("", "_blank");
	if (!tab) {
		toast.error(m.assets_file_viewer_error_title());
		return;
	}
	try {
		const { isError, data } = await refetch();
		if (isError || !data) throw new Error("No fresh URL");
		tab.location.href = data.url;
	} catch {
		tab.close();
		toast.error(m.assets_file_viewer_error_title());
	}
};
