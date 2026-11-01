import { BehaviourDocsLink } from "@/components/authoring/behaviour-docs-link";
import { BehaviourEditor } from "@/components/authoring/behaviour-editor";
import { withFieldGroup } from "@/hooks/form";
import { m } from "@/paraglide/messages";

const behaviourGroupDefaultValues = {
	name: "",
	description: "",
	contentJson: null as unknown,
	systemPrompt: "",
};

const behaviourTopLevelFieldMap = {
	name: "name",
	description: "description",
	contentJson: "contentJson",
	systemPrompt: "config.systemPrompt",
} as const;

const BehaviourFieldGroup = withFieldGroup({
	defaultValues: behaviourGroupDefaultValues,
	render: function Render({ group }) {
		return (
			<BehaviourEditor
				nameField={
					<group.AppField
						name="name"
						children={(field) => (
							<field.TextField
								label={m.common_name_label()}
								placeholder={m.blocks_behaviour_form_name_placeholder()}
							/>
						)}
					/>
				}
				systemPromptField={
					<div className="space-y-2">
						<group.AppField
							name="systemPrompt"
							children={(field) => (
								<field.TextareaField
									label={m.blocks_behaviour_form_system_prompt_label()}
									placeholder={m.blocks_behaviour_form_system_prompt_placeholder()}
									rows={12}
								/>
							)}
						/>
						<BehaviourDocsLink />
					</div>
				}
				descriptionField={
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
				}
				contentField={
					<group.AppField
						name="contentJson"
						children={(field) => (
							<field.BlockEditorField
								label={m.blocks_behaviour_form_content_label()}
							/>
						)}
					/>
				}
			/>
		);
	},
});

export { BehaviourFieldGroup, behaviourTopLevelFieldMap };
