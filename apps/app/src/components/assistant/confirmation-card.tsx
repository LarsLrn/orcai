import type { UseChatHelpers } from "@ai-sdk/react";
import { useId } from "react";
import {
	type SummarisedToolPart,
	toolSummaryOf,
	useToolSummaryLine,
} from "@/components/assistant/tool-summaries";
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
import type { ConfirmationVerb } from "@/lib/ai/tools/assistant/summary";
import type { ToolStatus } from "@/lib/ai/turn-view/turn-view";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { m } from "@/paraglide/messages";

export type AddToolApprovalResponse =
	UseChatHelpers<ChatAgentUIMessage>["addToolApprovalResponse"];

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
	addToolApprovalResponse,
}: {
	part: SummarisedToolPart;
	status: ToolStatus | null;
	/** Left out unless the card can be answered. */
	addToolApprovalResponse: AddToolApprovalResponse | undefined;
}) => {
	const summary = toolSummaryOf(part);
	const line = useToolSummaryLine(part);
	const Icon = summary.icon;
	const titleId = useId();
	const answerable =
		part.state === "approval-requested" && addToolApprovalResponse;
	const respond = (approved: boolean) => {
		if (part.state !== "approval-requested") return;
		void addToolApprovalResponse?.({
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
								summary.verb && destructiveVerbs.has(summary.verb)
									? "destructive"
									: "default"
							}
							size="sm"
							onClick={() => respond(true)}
						>
							{summary.verb
								? verbLabels[summary.verb]()
								: m.common_confirm_button()}
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
