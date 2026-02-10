import { courseFormOptions } from "@/components/courses/form/course-form-options";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withForm } from "@/hooks/form";

const CourseFormAiSettings = withForm({
	...courseFormOptions(),
	props: {
		title: "Course AI Settings",
	},
	render: ({ form, title }) => {
		return (
			<Card className="h-fit">
				<CardHeader>
					<CardTitle>{title}</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<form.AppField
						name="config.model"
						children={(field) => (
							<field.SelectField
								label="Model"
								placeholder="Choose an AI Model"
								options={[
									{
										label: "placeholder",
										value: "Placeholder Model",
									},
								]}
							/>
						)}
					/>

					<form.AppField
						name="config.systemPrompt"
						children={(field) => (
							<field.TextareaField
								label="System Prompt"
								placeholder="Your custom system prompt..."
								rows={10}
							/>
						)}
					/>

					<form.AppField
						name="config.maxReferences"
						children={(field) => (
							<field.TextField
								label="Maximum References"
								placeholder="5"
								type="number"
								description="The maximum number of references that can be used in a response. Note that this is referring to the number of individual chunks received by the AI, which may stem from the same document. This therefore does not directly correlate to the number of references cited in the response."
							/>
						)}
					/>
				</CardContent>
			</Card>
		);
	},
});

export { CourseFormAiSettings };
