import { attention, dismissFailure } from "@/lib/activity/attention";
import { dismissRun, listRunMembers, listRuns } from "@/lib/activity/runs";
import { activitySummary } from "@/lib/activity/summary";
import { getZedToken } from "@/lib/authz/zed-token";
import { authed } from "@/lib/orpc/implementation/authed";

const summary = authed.activity.summary.effect(function* ({ context }) {
	return yield* activitySummary({
		userId: context.auth.user.id,
		zedToken: getZedToken(context),
	});
});

const runs = authed.activity.runs.effect(function* ({ input, context }) {
	return yield* listRuns(
		{
			userId: context.auth.user.id,
			zedToken: getZedToken(context),
		},
		input,
	);
});

const attentionItems = authed.activity.attention.effect(function* ({
	context,
}) {
	return yield* attention({
		userId: context.auth.user.id,
		zedToken: getZedToken(context),
	});
});

const runMembers = authed.activity.runMembers.effect(function* ({
	input,
	context,
}) {
	return yield* listRunMembers(
		{
			userId: context.auth.user.id,
			zedToken: getZedToken(context),
		},
		input,
	);
});

const dismissActivityRun = authed.activity.dismissRun.effect(function* ({
	input,
	context,
}) {
	yield* dismissRun(input.runId, context.auth.user.id);
	return {
		success: true,
	};
});

const dismissActivityFailure = authed.activity.dismissFailure.effect(
	function* ({ input, context }) {
		yield* dismissFailure(
			{
				userId: context.auth.user.id,
				zedToken: getZedToken(context),
			},
			input.occurrenceId,
		);
		return {
			success: true,
		};
	},
);

export const activityRouter = {
	summary,
	runs,
	attention: attentionItems,
	runMembers,
	dismissRun: dismissActivityRun,
	dismissFailure: dismissActivityFailure,
};
