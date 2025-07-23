import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod/v4";
import { BlockEditor } from "@/components/editor";
import { FormInputField } from "@/components/forms/fields/form-input-field";
import { FormSelectField } from "@/components/forms/fields/form-select-field";
import { FormTextField } from "@/components/forms/fields/form-text-field";
import { FormValidationErrors } from "@/components/forms/fields/form-validation-errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import type { Course } from "@/db/schema/course";
import { saiaModels } from "@/lib/ai/saia-models";
import { courseInsertSchema } from "@/lib/orpc/contracts/course";
import { courseQueryOptions } from "@/lib/query-options/course";

const CourseForm = ({ course }: { course?: Course }) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	const { mutateAsync: updateCourse } = useMutation(
		courseQueryOptions.update(queryClient),
	);
	const { mutateAsync: createCourse } = useMutation(
		courseQueryOptions.create(queryClient),
	);

	const form = useForm<z.infer<typeof courseInsertSchema>>({
		resolver: zodResolver(courseInsertSchema),
		defaultValues: {
			title: course?.title ?? undefined,
			description: course?.description ?? "",
			contentJson: course?.contentJson ?? "",
			contentHtml: course?.contentHtml ?? "",
			config: {
				systemPrompt: course?.config?.systemPrompt ?? "",
				maxReferences: course?.config?.maxReferences ?? 5,
				model: course?.config?.model ?? "",
			},
		},
	});

	const onSubmit = (values: z.infer<typeof courseInsertSchema>) => {
		if (course) {
			toast.promise(
				updateCourse({
					...values,
					id: course.id,
				}),
				{
					loading: "Updating course...",
					success: () => {
						router.history.back();
						return "Course updated successfully";
					},
					error: (error) => ({
						message: "Failed to update course",
						description: error.message,
					}),
				},
			);
		} else {
			toast.promise(createCourse(values), {
				loading: "Creating course...",
				success: (result) => {
					router.navigate({
						to: "/app/courses/$courseId",
						params: { courseId: result.data.id },
					});
					return "Course created successfully";
				},
				error: (error) => ({
					message: "Failed to create course",
					description: error.message,
				}),
			});
		}
	};
	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="space-y-4"
				noValidate
			>
				{/* Validation Errors Section */}
				<FormValidationErrors form={form} />

				<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
					<Card className="lg:col-span-2">
						<CardContent className="flex flex-col gap-4 p-6">
							<FormInputField
								form={form}
								name="title"
								label="Title"
								placeholder="Course title"
								inputType="text"
								required={true}
							/>

							<FormTextField
								form={form}
								name="description"
								label="Short Description"
								placeholder="Short course description"
								required={true}
							/>

							<div className="space-y-2">
								<Label>
									Course Description
									<span className="bold text-muted-foreground"> *</span>
								</Label>
								{/* TODO: Improve handling of JSON */}
								<BlockEditor
									content={form.getValues("contentJson")}
									onUpdate={(value) => {
										form.setValue("contentJson", value.getJSON());
										form.setValue("contentHtml", value.getHTML());
									}}
								/>
							</div>
						</CardContent>
					</Card>
					<Card className="h-fit">
						<CardHeader>
							<CardTitle>Course AI Settings</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<FormSelectField
								form={form}
								name="config.model"
								options={saiaModels.map((model) => ({
									value: model.id,
									label: model.name,
								}))}
								label="Model"
								placeholder="Choose an AI Model"
								required={false}
							/>

							<FormTextField
								form={form}
								name="config.systemPrompt"
								rows={10}
								label="System Prompt"
								placeholder="Your custom system prompt..."
								required={false}
							/>

							<FormInputField
								form={form}
								name="config.maxReferences"
								label="Maximum References"
								placeholder="5"
								required={false}
								inputType="number"
								description="The maximum number of references that can be used in a
                    response. Note that this is referring to the number of individual chunks received by the AI,
                    which may stem from the same document. This therefore does not directly correlate to the
                    number of references cited in the response."
							/>
						</CardContent>
					</Card>
				</div>
				<Button type="submit">Save Course</Button>
			</form>
		</Form>
	);
};

export { CourseForm };
