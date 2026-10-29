import type { BotId } from "@orcai/core";
import type { BotSetup } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { MODEL_STEP_INDEX } from "@/components/authoring/bot-editor-steps";
import { BotModelStep } from "@/components/bot/setup/bot-model-step";
import { useQuotaStatus } from "@/components/quota/use-quota-status";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** Setup editors see how many of the bot's audience are covered. */
const CoverageCount = ({
	botId,
	modelId,
}: {
	botId: BotId;
	modelId: NonNullable<BotSetup["model"]>["id"];
}) => {
	const { data: coverage } = useQuery(
		orpc.botSetup.coverage.queryOptions({
			input: {
				botId,
				modelId,
			},
		}),
	);
	const principals = coverage?.data.principals;
	if (!principals || principals.length === 0) return null;

	return (
		<p className="text-muted-foreground text-sm tabular-nums">
			{m.bot_setup_coverage_count({
				covered: principals.filter((entry) => entry.covered).length,
				total: principals.length,
			})}
		</p>
	);
};

/** Everyone else sees only whether they can use the model themselves. */
const OwnUsability = ({ model }: { model: NonNullable<BotSetup["model"]> }) => {
	const { data: quota } = useQuotaStatus({
		providerId: model.providerId,
		modelId: model.id,
	});
	if (!quota) return null;

	return (
		<p className="text-muted-foreground text-sm">
			{model.usable && quota.data.available
				? m.bot_setup_summary_available()
				: m.bot_setup_summary_unavailable()}
		</p>
	);
};

/** The bot's model in the active organisation, on its detail page. */
/** Where a bot's setup is edited: its editor's Model step, or a dialog where the organisation added it from the catalogue. */
const EditSetup = ({
	botId,
	installed,
}: {
	botId: BotId;
	installed: boolean;
}) => {
	const [open, setOpen] = useState(false);
	const className = buttonVariants({
		variant: "outline",
		size: "sm",
		className: "self-start",
	});
	if (!installed)
		return (
			<Link
				to="/app/library/bots/$botId/setup"
				params={{
					botId,
				}}
				search={{
					step: MODEL_STEP_INDEX,
				}}
				className={className}
			>
				{m.bot_setup_summary_edit_action()}
			</Link>
		);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger className={className}>
				{m.bot_setup_summary_edit_action()}
			</DialogTrigger>
			<DialogContent className="flex max-h-[92vh] flex-col sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>{m.bot_setup_title()}</DialogTitle>
				</DialogHeader>
				<DialogBody>
					<BotModelStep botId={botId} />
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
};

const BotSetupSummary = ({
	botId,
	installed,
}: {
	botId: BotId;
	/** The active organisation added the bot from the catalogue. */
	installed: boolean;
}) => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data: organization } = useQuery(
		orpc.organization.find.queryOptions({
			input: {
				id: auth.session.activeOrganizationId,
			},
		}),
	);
	const { data: found } = useQuery(
		orpc.botSetup.find.queryOptions({
			input: {
				botId,
			},
		}),
	);
	if (!found) return null;
	const { setup, canEdit } = found.data;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">
					{m.bot_setup_summary_title({
						organisation:
							organization?.data.name ??
							m.chat_model_notice_organisation_fallback(),
					})}
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				{setup ? (
					<>
						<div className="flex flex-wrap items-center gap-2">
							<span className="font-medium text-sm">
								{setup.model?.name ?? m.chat_model_locked_missing_label()}
							</span>
							<Badge variant="secondary">
								{setup.strength === "required"
									? m.bot_setup_strength_required_label()
									: m.bot_setup_strength_recommended_label()}
							</Badge>
							{!setup.model?.usable && (
								<Badge variant="destructive">
									{m.bot_setup_summary_model_missing()}
								</Badge>
							)}
						</div>
						{setup.model &&
							(canEdit ? (
								<CoverageCount botId={botId} modelId={setup.model.id} />
							) : (
								<OwnUsability model={setup.model} />
							))}
					</>
				) : (
					<p className="text-muted-foreground text-sm">
						{m.bot_setup_summary_free()}
					</p>
				)}
				{canEdit && <EditSetup botId={botId} installed={installed} />}
			</CardContent>
		</Card>
	);
};

export { BotSetupSummary };
