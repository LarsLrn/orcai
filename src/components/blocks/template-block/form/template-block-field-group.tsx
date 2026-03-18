import { TemplateBlockEditor } from "@/components/authoring/template-block-editor";
import { withFieldGroup } from "@/hooks/form";

const templateBlockGroupDefaultValues = {
	name: "",
	description: "",
	contentJson: null as unknown,
	contentHtml: "",
	systemPrompt: "",
};

const templateBlockTopLevelFieldMap = {
	name: "name",
	description: "description",
	contentJson: "contentJson",
	contentHtml: "contentHtml",
	systemPrompt: "config.systemPrompt",
} as const;

const templateBlockBuilderFieldMap = {
	name: "templateBlock.name",
	description: "templateBlock.description",
	contentJson: "templateBlock.contentJson",
	contentHtml: "templateBlock.contentHtml",
	systemPrompt: "templateBlock.config.systemPrompt",
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
							<field.TextField label="Name" placeholder="AI Behaviour" />
						)}
					/>
				}
				systemPromptField={
					<group.AppField
						name="systemPrompt"
						children={(field) => (
							<field.TextareaField
								label="System Prompt"
								placeholder="Explain the bot's role, response style, and constraints."
								rows={12}
							/>
						)}
					/>
				}
				descriptionField={
					<group.AppField
						name="description"
						children={(field) => (
							<field.TextareaField
								label="Short Description"
								placeholder="Define the purpose of this block."
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
								label="Detailed Description"
								htmlFieldName="contentHtml"
							/>
						)}
					/>
				}
			/>
		);
	},
});

export {
	TemplateBlockFieldGroup,
	templateBlockBuilderFieldMap,
	templateBlockTopLevelFieldMap,
};
