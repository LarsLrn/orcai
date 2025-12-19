import { courseFormOptions } from "@/components/courses/form/course-form-options";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withForm } from "@/hooks/form";

const CourseFormInfo = withForm({
	...courseFormOptions(),
	props: {
		title: "About the Course",
		className: "",
	},
	render: ({ form, title, className }) => {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>{title}</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<form.AppField
						name="title"
						children={(field) => (
							<field.TextField label="Title" placeholder="Course title" />
						)}
					/>

					<form.AppField
						name="description"
						children={(field) => (
							<field.TextareaField
								label="Short Description"
								placeholder="Short course description"
							/>
						)}
					/>

					<form.AppField
						name="contentJson"
						children={(field) => (
							<field.BlockEditorField
								label="Course Description"
								htmlFieldName="contentHtml"
							/>
						)}
					/>
				</CardContent>
			</Card>
		);
	},
});

export { CourseFormInfo };
