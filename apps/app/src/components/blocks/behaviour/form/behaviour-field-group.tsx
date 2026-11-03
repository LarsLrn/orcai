import { SparklesIcon } from "lucide-react";
import { BehaviourDocsLink } from "@/components/authoring/behaviour-docs-link";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { withFieldGroup } from "@/hooks/form";
import { m } from "@/paraglide/messages";

const behaviourGroupDefaultValues = {
	name: "",
	description: "",
	contentJson: null as unknown,
	config: {
		systemPrompt: "",
	},
};

const BehaviourFieldGroup = withFieldGroup({
	defaultValues: behaviourGroupDefaultValues,
	props: {} as {
		/** Offers an example system prompt to start from. */
		withExample?: boolean;
	},
	render: function Render({ group, withExample }) {
		return (
			<Card className="min-w-0 rounded-2xl">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<SparklesIcon className="h-5 w-5" />
						{m.authoring_behaviour_title()}
					</CardTitle>
					<CardDescription>
						{m.authoring_behaviour_description()}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<group.AppField
						name="name"
						children={(field) => (
							<field.TextField
								label={m.common_name_label()}
								placeholder={m.blocks_behaviour_form_name_placeholder()}
							/>
						)}
					/>
					<group.AppField
						name="config.systemPrompt"
						children={(field) => (
							<div className="space-y-2">
								<field.TextareaField
									label={m.blocks_behaviour_form_system_prompt_label()}
									placeholder={
										withExample
											? m.authoring_behaviour_example()
											: m.blocks_behaviour_form_system_prompt_placeholder()
									}
									rows={12}
								/>
								<BehaviourDocsLink />
								{withExample ? (
									<div className="flex flex-wrap items-center gap-3">
										<Button
											variant="outline"
											size="sm"
											disabled={!!field.state.value.trim()}
											onClick={() =>
												field.handleChange(m.authoring_behaviour_example())
											}
										>
											{m.authoring_behaviour_example_button()}
										</Button>
										<span className="text-muted-foreground text-xs">
											{m.authoring_behaviour_example_hint()}
										</span>
									</div>
								) : null}
							</div>
						)}
					/>
					<group.AppField
						name="description"
						children={(field) => (
							<field.TextareaField
								label={m.blocks_behaviour_form_description_label()}
								placeholder={m.blocks_behaviour_form_description_placeholder()}
								rows={4}
							/>
						)}
					/>
					<group.AppField
						name="contentJson"
						children={(field) => (
							<field.BlockEditorField
								label={m.blocks_behaviour_form_content_label()}
							/>
						)}
					/>
				</CardContent>
			</Card>
		);
	},
});

export { BehaviourFieldGroup };
