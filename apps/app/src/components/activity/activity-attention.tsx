import type { OrganizationId } from "@orcai/core";
import type { ActivityFailure } from "@orcai/schema";
import { useMutation } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSetActiveOrganizationMutation } from "@/hooks/mutations/use-user-mutations";
import { describeError } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { failureSummary, failureTitle } from "@/lib/presentation/activity";
import { m } from "@/paraglide/messages";
import { activityOpen } from "./activity-state";
import { AttentionWell } from "./activity-visuals";

const closeActivity = () => activityOpen.set(false);

/** A row whose text is one link covering the row, so buttons beside it stay separate. */
const rowClassName =
	"relative flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-muted has-[a:focus-visible,button[data-row-link]:focus-visible]:ring-3 has-[a:focus-visible,button[data-row-link]:focus-visible]:ring-ring/75";
const coverClassName =
	"min-w-0 flex-1 text-left outline-none after:absolute after:inset-0";

/**
 * Opens the Library's Suggestions to review. Suggestions of another
 * organisation are reviewed there, so it switches first.
 */
export const ReviewSuggestionsLink = ({
	organizationId,
	className,
	children,
}: {
	organizationId: OrganizationId;
	className?: string;
	children: React.ReactNode;
}) => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const target = {
		to: "/app/library/assets",
		search: {
			review: true,
		},
	} as const;
	const switchTo = useSetActiveOrganizationMutation({}, target);

	if (organizationId === auth.session.activeOrganizationId) {
		return (
			<Link {...target} onClick={closeActivity} className={className}>
				{children}
			</Link>
		);
	}
	return (
		<button
			type="button"
			data-row-link
			disabled={switchTo.isPending}
			onClick={() => {
				closeActivity();
				switchTo.mutate({
					organizationId,
				});
			}}
			className={className}
		>
			{children}
		</button>
	);
};

export const SuggestionsRow = ({
	organization,
	count,
}: {
	organization: {
		id: OrganizationId;
		name: string;
	};
	count: number;
}) => (
	<li className="px-2">
		<div className={rowClassName}>
			<AttentionWell kind="suggestions" className="mt-0.5" />
			<ReviewSuggestionsLink
				organizationId={organization.id}
				className={coverClassName}
			>
				<span className="block font-medium text-sm">
					{m.activity_suggestions_title({
						count,
					})}
				</span>
				<span className="block truncate text-muted-foreground text-xs">
					{organization.name}
				</span>
			</ReviewSuggestionsLink>
			<span
				aria-hidden="true"
				className="mt-1 shrink-0 font-medium text-primary text-xs"
			>
				{m.activity_suggestions_review()}
			</span>
		</div>
	</li>
);

/** Where a failure can be looked at and repaired. */
const FailureLink = ({
	failure,
	children,
}: {
	failure: ActivityFailure;
	children: React.ReactNode;
}) => {
	if (failure.stage === "export" || !failure.asset) {
		return (
			<Link
				to="/app/account/data"
				onClick={closeActivity}
				className={coverClassName}
			>
				{children}
			</Link>
		);
	}
	if (failure.stage === "indexing" && failure.repository) {
		return (
			<Link
				to="/app/library/repositories/$blockId"
				params={{
					blockId: failure.repository.id,
				}}
				onClick={closeActivity}
				className={coverClassName}
			>
				{children}
			</Link>
		);
	}
	return (
		<Link
			to="/app/library/assets/$assetId"
			params={{
				assetId: failure.asset.id,
			}}
			onClick={closeActivity}
			className={coverClassName}
		>
			{children}
		</Link>
	);
};

export const FailureRow = ({
	failure,
	onDismissed,
}: {
	failure: ActivityFailure;
	/** Takes focus somewhere else once the row is gone. */
	onDismissed: () => void;
}) => {
	const title = failureTitle(failure);
	const dismiss = useMutation(
		orpc.activity.dismissFailure.mutationOptions({
			onSuccess: onDismissed,
			onError: (error) => toast.error(describeError(error)),
		}),
	);

	return (
		<li className="px-2">
			<div className={rowClassName}>
				<AttentionWell kind="failure" className="mt-0.5" />
				<FailureLink failure={failure}>
					<span className="block break-words font-medium text-sm">{title}</span>
					<span className="line-clamp-2 text-muted-foreground text-xs">
						{failureSummary(failure)}
					</span>
				</FailureLink>
				<Button
					variant="ghost"
					size="icon-xs"
					className="relative z-1 shrink-0"
					aria-label={m.activity_dismiss_label({
						title,
					})}
					disabled={dismiss.isPending}
					onClick={() =>
						dismiss.mutate({
							occurrenceId: failure.occurrenceId,
						})
					}
				>
					<XIcon aria-hidden="true" />
				</Button>
			</div>
		</li>
	);
};
