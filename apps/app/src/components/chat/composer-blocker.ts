import type { QuotaStatus } from "@orcai/schema";
import { isExhaustedShare } from "@/lib/presentation/quota-share";

/** Why the composer cannot send. */
type ComposerBlocker =
	| {
			reason: "model" | "quota";
	  }
	| {
			reason: "exhausted";
			resetsAt: Date;
	  };

/** No usable model comes first, then no pool covering the model, then a used-up pool. */
const composerBlocker = ({
	modelAvailable,
	quota,
}: {
	modelAvailable: boolean;
	/** Unknown while it loads, which blocks nothing. */
	quota: QuotaStatus | undefined;
}): ComposerBlocker | undefined => {
	if (!modelAvailable) {
		return {
			reason: "model",
		};
	}
	if (quota && !quota.available) {
		return {
			reason: "quota",
		};
	}
	if (quota?.pool && isExhaustedShare(quota.pool.usedShare)) {
		return {
			reason: "exhausted",
			resetsAt: quota.pool.periodEndsAt,
		};
	}
	return undefined;
};

export { type ComposerBlocker, composerBlocker };
