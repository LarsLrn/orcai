import type { BlockId } from "@orcai/core";
import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import {
	botEditorFormOptions,
	newBehaviourValues,
} from "@/components/authoring/bot-editor-form-options";
import { ReadOnlyBehaviourCard } from "@/components/authoring/steps/read-only-block-cards";
import { BehaviourFieldGroup } from "@/components/blocks/behaviour/form/behaviour-field-group";
import { BlockSelectorDialog } from "@/components/blocks/block-selector-dialog";
import { FeaturesSection } from "@/components/features/features-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { withForm } from "@/hooks/form";
import { hasCapability } from "@/lib/authz/capabilities";
import { m } from "@/paraglide/messages";

const BehaviourStep = withForm({
	...botEditorFormOptions,
	props: {} as {
		onLink: (blockId: BlockId) => Promise<void>;
	},
	render: function Render({ form, onLink }) {
		const behaviour = useSelector(
			form.store,
			(state) => state.values.behaviour,
		);
		const [isLibraryOpen, setIsLibraryOpen] = useState(false);

		return (
			<div className="grid min-w-0 grid-cols-1 gap-4">
				{behaviour ? (
					<div className="flex flex-wrap justify-end gap-2">
						<Button variant="outline" onClick={() => setIsLibraryOpen(true)}>
							{m.authoring_behaviour_use_existing_action()}
						</Button>
					</div>
				) : null}

				{behaviour ? (
					hasCapability(behaviour.capabilities, "edit") || !behaviour.id ? (
						<BehaviourFieldGroup form={form} fields="behaviour" withExample />
					) : (
						<ReadOnlyBehaviourCard block={behaviour} />
					)
				) : (
					<Card className="min-w-0 rounded-2xl">
						<CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
							<div>
								<div className="font-medium">
									{m.authoring_behaviour_empty_state_title()}
								</div>
								<div className="text-muted-foreground text-sm">
									{m.authoring_behaviour_empty_state_description()}
								</div>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									onClick={() =>
										form.setFieldValue("behaviour", newBehaviourValues())
									}
								>
									{m.authoring_behaviour_create_action()}
								</Button>
								<Button
									variant="outline"
									onClick={() => setIsLibraryOpen(true)}
								>
									{m.authoring_behaviour_use_existing_action()}
								</Button>
							</div>
						</CardContent>
					</Card>
				)}

				<Card className="min-w-0 rounded-2xl">
					<CardContent className="p-6">
						<form.Field
							name="features"
							children={(field) => (
								<FeaturesSection
									value={field.state.value}
									onChange={field.handleChange}
								/>
							)}
						/>
					</CardContent>
				</Card>

				<BlockSelectorDialog
					open={isLibraryOpen}
					onOpenChange={setIsLibraryOpen}
					type="behaviour"
					includeDrafts
					selectedIds={
						behaviour?.id
							? [
									behaviour.id,
								]
							: []
					}
					onSelect={(block) => onLink(block.id)}
					title={m.authoring_behaviour_library_dialog_title()}
					description={m.authoring_behaviour_library_dialog_description()}
				/>
			</div>
		);
	},
});

export { BehaviourStep };
