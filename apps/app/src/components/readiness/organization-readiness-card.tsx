import type { OrganizationCheck, OrganizationCheckId } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, type LinkProps } from "@tanstack/react-router";
import { CircleCheckIcon } from "lucide-react";
import { CheckList } from "@/components/health/check-list";
import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const checks: Record<
	OrganizationCheckId,
	{
		title: () => string;
		fix: LinkProps["to"];
	}
> = {
	provider: {
		title: m.readiness_check_provider_title,
		fix: "/app/providers",
	},
	"chat-model": {
		title: m.readiness_check_chat_model_title,
		fix: "/app/models",
	},
	pool: {
		title: m.readiness_check_pool_title,
		fix: "/app/quotas",
	},
	"assistant-model": {
		title: m.readiness_check_assistant_model_title,
		fix: "/app/organization",
	},
	"assistant-pool": {
		title: m.readiness_check_assistant_pool_title,
		fix: "/app/quotas",
	},
	"utility-model": {
		title: m.readiness_check_utility_model_title,
		fix: "/app/organization",
	},
	members: {
		title: m.readiness_check_members_title,
		fix: "/app/users/invites",
	},
	coverage: {
		title: m.readiness_check_coverage_title,
		fix: "/app/quotas",
	},
};

const fixClassName = buttonVariants({
	variant: "outline",
	size: "sm",
});

export const readinessQuery = () =>
	orpc.readiness.organization.queryOptions({
		input: {},
	});

export const organizationCheckTitle = (check: OrganizationCheck) =>
	checks[check.id].title();

/** The active organisation's setup checklist; one line once everything passes. */
export const OrganizationReadinessCard = () => {
	const {
		data: { data: readiness },
	} = useSuspenseQuery(readinessQuery());

	if (readiness.checks.every((check) => check.status === "ok")) {
		return (
			<p
				role="status"
				className="flex items-center gap-2 text-muted-foreground text-sm"
			>
				<CircleCheckIcon className="size-4 text-status-success" />
				{m.readiness_ready_line()}
			</p>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.readiness_card_title()}</CardTitle>
				<CardDescription>{m.readiness_card_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				<CheckList
					checks={readiness.checks}
					title={organizationCheckTitle}
					action={(check) =>
						check.reason === "CHAT_MODEL_CAPABILITIES_UNKNOWN" ? (
							<Link
								to="/app/models"
								search={{
									capabilities: "unset",
								}}
								className={fixClassName}
							>
								{m.readiness_fix_action()}
							</Link>
						) : (
							<Link to={checks[check.id].fix} className={fixClassName}>
								{m.readiness_fix_action()}
							</Link>
						)
					}
				/>
			</CardContent>
		</Card>
	);
};

/** Failing required checks, which keep members from chatting. */
export const failingRequired = (checks: readonly OrganizationCheck[]) =>
	checks.filter(
		(check) => check.severity === "required" && check.status === "failing",
	).length;
