import { botEditorFormOptions } from "@/components/authoring/bot-editor-form-options";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { withForm } from "@/hooks/form";
import { m } from "@/paraglide/messages";

const BasicsStep = withForm({
	...botEditorFormOptions,
	render: function Render({ form }) {
		return (
			<div className="grid min-w-0 grid-cols-1 gap-6">
				<Card className="min-w-0 rounded-2xl">
					<CardHeader>
						<CardTitle>{m.authoring_basics_identity_title()}</CardTitle>
						<CardDescription>
							{m.authoring_basics_identity_description()}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<form.AppField
							name="name"
							children={(field) => (
								<field.TextField
									label={m.authoring_basics_name_label()}
									placeholder={m.authoring_basics_name_placeholder()}
								/>
							)}
						/>
						<form.AppField
							name="description"
							children={(field) => (
								<field.TextareaField
									label={m.authoring_basics_description_label()}
									placeholder={m.authoring_basics_description_placeholder()}
									rows={4}
								/>
							)}
						/>
					</CardContent>
				</Card>

				<Card className="min-w-0 rounded-2xl">
					<CardHeader>
						<CardTitle>{m.authoring_basics_content_title()}</CardTitle>
						<CardDescription>
							{m.authoring_basics_content_description()}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form.AppField
							name="contentJson"
							children={(field) => (
								<field.BlockEditorField
									label={m.authoring_basics_content_label()}
								/>
							)}
						/>
					</CardContent>
				</Card>
			</div>
		);
	},
});

export { BasicsStep };
