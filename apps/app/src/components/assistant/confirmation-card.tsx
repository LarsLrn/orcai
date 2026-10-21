import { getToolName } from "ai";
import { useId } from "react";
import { useToolSummaryLine } from "@/components/assistant/tool-summary-line";
import {
	isFailedStatus,
	toolStatusLabel,
} from "@/components/chat/message/work-log/tool-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import type { StepAnswers } from "@/lib/ai/chat-session/chat-session";
import type { ConfirmationVerb } from "@/lib/ai/tools/declaration";
import { toolDeclarationOf, toolLabels } from "@/lib/ai/tools/registry";
import type { ToolPart, ToolStatus } from "@/lib/ai/turn-view/turn-view";
import { m } from "@/paraglide/messages";

const verbLabels: Record<ConfirmationVerb, () => string> = {
	delete: m.common_delete_button,
	remove: m.common_remove_button,
	withdraw: m.assistant_confirmation_withdraw,
	grant: m.assistant_confirmation_grant,
	add: m.common_add_button,
	change: m.assistant_confirmation_change,
	invite: m.assistant_confirmation_invite,
};

const destructiveVerbs = new Set<ConfirmationVerb>([
	"delete",
	"remove",
	"withdraw",
]);

/** A gated call waiting for the user: its summary line, its verb and Cancel. */
export const ConfirmationCard = ({
	part,
	status,
	answers,
}: {
	part: ToolPart;
	status: ToolStatus | null;
	/** Left out unless the card can be answered. */
	answers: StepAnswers | undefined;
}) => {
	const verb = toolDeclarationOf(getToolName(part))?.confirm;
	const line = useToolSummaryLine(part);
	const Icon = toolLabels(part).icon;
	const titleId = useId();
	const answerable = part.state === "approval-requested" && answers;
	const respond = (approved: boolean) => {
		if (part.state !== "approval-requested") return;
		answers?.approve({
			id: part.approval.id,
			approved,
		});
	};

	return (
		<Item
			variant="outline"
			size="sm"
			className="not-prose"
			role="group"
			aria-labelledby={titleId}
		>
			<ItemMedia variant="icon">
				<Icon />
			</ItemMedia>
			<ItemContent>
				<ItemTitle id={titleId} className="line-clamp-none">
					{line}
				</ItemTitle>
			</ItemContent>
			<ItemActions>
				{answerable ? (
					<>
						<Button variant="outline" size="sm" onClick={() => respond(false)}>
							{m.common_cancel_button()}
						</Button>
						<Button
							variant={
								verb && destructiveVerbs.has(verb) ? "destructive" : "default"
							}
							size="sm"
							onClick={() => respond(true)}
						>
							{verb ? verbLabels[verb]() : m.common_confirm_button()}
						</Button>
					</>
				) : (
					status && (
						<Badge variant={isFailedStatus(status) ? "danger" : "outline"}>
							{toolStatusLabel(status)}
						</Badge>
					)
				)}
			</ItemActions>
		</Item>
	);
};
