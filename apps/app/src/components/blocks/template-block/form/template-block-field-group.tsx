import { BehaviourDocsLink } from "@/components/authoring/behaviour-docs-link";
import { TemplateBlockEditor } from "@/components/authoring/template-block-editor";
import { withFieldGroup } from "@/hooks/form";
import { m } from "@/paraglide/messages";

const templateBlockGroupDefaultValues = {
	name: "",
	description: "",
	contentJson: null as unknown,
	systemPrompt: "",
};

const templateBlockTopLevelFieldMap = {
	name: "name",
	description: "description",
	contentJson: "contentJson",
	systemPrompt: "config.systemPrompt",
} as const;

const TemplateBlockFieldGroup = withFieldGroup({
	defaultValues: templateBlockGroupDefaultValues,
	render: function Render({ group }) {
		return (
			<TemplateBlockEditor
				nameField={
					<group.AppField
						name="name"
						children={(field) => (
							<field.TextField
								label={m.common_name_label()}
								placeholder={m.blocks_template_form_name_placeholder()}
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
									label={m.blocks_template_form_system_prompt_label()}
									placeholder={m.blocks_template_form_system_prompt_placeholder()}
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
								label={m.blocks_template_form_description_label()}
								placeholder={m.blocks_template_form_description_placeholder()}
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
								label={m.blocks_template_form_content_label()}
							/>
						)}
					/>
				}
			/>
		);
	},
});

export { TemplateBlockFieldGroup, templateBlockTopLevelFieldMap };
