import type { PublicationStatus } from "@orcai/schema";
import type { BotEditorFormValues } from "@/components/authoring/bot-editor-form-options";
import type { BotEditorBlockSlot } from "@/components/authoring/bot-editor-save";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { hasCapability } from "@/lib/authz/capabilities";
import { getPublicationStatusOptions } from "@/lib/presentation/publication-status";
import { m } from "@/paraglide/messages";

const ReviewStep = ({
	editor,
	visibility,
	grantCount,
	issues,
	onStatusChange,
	isSettingBlockStatus,
}: {
	editor: BotEditorFormValues;
	visibility?: "private" | "public";
	grantCount: number;
	issues: string[];
	onStatusChange: (slot: BotEditorBlockSlot, status: PublicationStatus) => void;
	isSettingBlockStatus: boolean;
}) => {
	const publicationStatusOptions = getPublicationStatusOptions();

	return (
		<Card className="border-border/70 bg-background min-w-0 rounded-2xl">
			<CardHeader>
				<CardTitle>{m.authoring_review_title()}</CardTitle>
				<CardDescription>{m.authoring_review_description()}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<div>
					<div className="text-sm font-medium">
						{m.authoring_review_bot_label()}
					</div>
					<div className="mt-2 rounded-xl border p-4">
						<div className="font-medium">
							{editor.name || m.authoring_review_bot_untitled()}
						</div>
						<div className="text-muted-foreground mt-1 text-sm">
							{editor.description || m.authoring_review_bot_no_description()}
						</div>
					</div>
				</div>

				<Separator />

				<div>
					<div className="text-sm font-medium">
						{m.authoring_review_behaviour_label()}
					</div>
					<div className="mt-2 rounded-xl border p-4 text-sm">
						{editor.behaviour ? (
							<>
								<div className="font-medium">{editor.behaviour.name}</div>
								<div className="text-muted-foreground mt-1">
									{m.authoring_review_behaviour_hint()}
								</div>
								<div className="mt-3 max-w-sm space-y-2">
									<Label htmlFor="review-behaviour-status">
										{m.authoring_review_behaviour_status_label()}
									</Label>
									<OptionPicker
										id="review-behaviour-status"
										options={publicationStatusOptions}
										value={editor.behaviour.status}
										onChange={(status) => onStatusChange("behaviour", status)}
										disabled={
											Boolean(
												editor.behaviour.id &&
													!hasCapability(editor.behaviour.capabilities, "edit"),
											) || isSettingBlockStatus
										}
									/>
									{editor.behaviour.id &&
									!hasCapability(editor.behaviour.capabilities, "edit") ? (
										<p className="text-muted-foreground text-xs">
											{m.authoring_review_behaviour_readonly_hint()}
										</p>
									) : null}
								</div>
							</>
						) : (
							<div className="text-muted-foreground">
								{m.authoring_review_behaviour_empty_state()}
							</div>
						)}
					</div>
				</div>

				<Separator />

				<div>
					<div className="text-sm font-medium">
						{m.authoring_review_repositories_label()}
					</div>
					<div className="mt-2 space-y-3">
						{editor.repositories.length === 0 ? (
							<div className="text-muted-foreground rounded-xl border p-4 text-sm">
								{m.authoring_review_repositories_empty_state()}
							</div>
						) : (
							editor.repositories.map((repository, index) => (
								<div
									key={repository.id ?? `review-db-${index}`}
									className="rounded-xl border p-4"
								>
									<div className="font-medium">{repository.name}</div>
									<div className="text-muted-foreground mt-1 text-sm">
										{m.authoring_attached_asset_count({
											count: repository.assetIds.length,
										})}
									</div>
									<div className="mt-3 max-w-sm space-y-2">
										<Label htmlFor={`review-db-status-${index}`}>
											{m.authoring_review_repository_status_label()}
										</Label>
										<OptionPicker
											id={`review-db-status-${index}`}
											options={publicationStatusOptions}
											value={repository.status}
											onChange={(status) => onStatusChange(index, status)}
											disabled={
												Boolean(
													repository.id &&
														!hasCapability(repository.capabilities, "edit"),
												) || isSettingBlockStatus
											}
										/>
										{repository.id &&
										!hasCapability(repository.capabilities, "edit") ? (
											<p className="text-muted-foreground text-xs">
												{m.authoring_review_repository_readonly_hint()}
											</p>
										) : null}
									</div>
								</div>
							))
						)}
					</div>
				</div>

				<Separator />

				<div className="grid gap-4 md:grid-cols-2">
					<div className="rounded-xl border p-4">
						<div className="text-sm font-medium">
							{m.authoring_review_visibility_label()}
						</div>
						<div className="text-muted-foreground mt-1 text-sm">
							{visibility === "public"
								? m.authoring_review_visibility_public()
								: m.authoring_review_visibility_private()}
						</div>
					</div>
					<div className="rounded-xl border p-4">
						<div className="text-sm font-medium">
							{m.authoring_review_grants_label()}
						</div>
						<div className="text-muted-foreground mt-1 text-sm">
							{m.authoring_review_grant_count({
								count: grantCount,
							})}
						</div>
					</div>
				</div>

				{issues.length > 0 ? (
					<div className="border-destructive/30 bg-destructive/5 rounded-xl border p-4">
						<div className="text-destructive text-sm font-medium">
							{m.authoring_review_issues_title()}
						</div>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
							{issues.map((issue) => (
								<li key={issue}>{issue}</li>
							))}
						</ul>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
};

export { ReviewStep };
