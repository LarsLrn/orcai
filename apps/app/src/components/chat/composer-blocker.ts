import type { BotId } from "@orcai/core";
import type { QuotaStatus } from "@orcai/schema";
import { isExhaustedShare } from "@/lib/presentation/quota-share";

/** Why the composer cannot send. */
type ComposerBlocker =
	| {
			reason: "model" | "quota";
	  }
	| {
			reason: "bot-model";
			botId: BotId;
	  }
	| {
			reason: "exhausted";
			resetsAt: Date;
	  };

/**
 * A bot's required model that is missing, unusable or uncovered comes first,
 * then no usable model, then no pool covering the model, then a used-up pool.
 */
const composerBlocker = ({
	modelAvailable,
	quota,
	requiredBy,
}: {
	modelAvailable: boolean;
	/** Unknown while it loads, which blocks nothing. */
	quota: QuotaStatus | undefined;
	/** The bot whose setup requires the model, and whether turns can use it. */
	requiredBy?: {
		botId: BotId;
		usable: boolean;
	};
}): ComposerBlocker | undefined => {
	if (requiredBy && (!requiredBy.usable || (quota && !quota.available))) {
		return {
			reason: "bot-model",
			botId: requiredBy.botId,
		};
	}
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
