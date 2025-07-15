import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod/v4";
import { FormInputField } from "@/components/forms/fields/formInputField";
import { FormSelect } from "@/components/forms/fields/formSelect";
import { FormSwitch } from "@/components/forms/fields/formSwitch";
import { FormTextField } from "@/components/forms/fields/formTextField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField } from "@/components/ui/form";
import type { Document } from "@/db/schema/document";
import { assetUpdateSchema } from "@/lib/orpc/contracts/asset";
import { orpc } from "@/lib/orpc/orpc";

const DocumentForm = ({ document }: { document: Document }) => {
	const queryClient = useQueryClient();
	const router = useRouter();

	const { mutateAsync: updateAsset } = useMutation(
		orpc.asset.update.mutationOptions({
			onSuccess() {
				queryClient.invalidateQueries({
					queryKey: orpc.asset.key(),
				});
			},
			onError(error) {
				console.error(error);
				alert(error.message);
			},
		}),
	);

	const form = useForm<z.infer<typeof assetUpdateSchema>>({
		resolver: zodResolver(assetUpdateSchema),
		defaultValues: {
			id: document.id,
			title: document?.title ?? undefined,
			metadata: {
				citation: document.metadata?.citation ?? undefined,
				externalUrl: document.metadata?.externalUrl ?? undefined,
				relevance: document.metadata?.relevance ?? "medium",
				showReference: document.metadata?.showReference ?? true,
				pageRange: document.metadata?.pageRange ?? undefined,
				author: document.metadata?.author ?? undefined,
				chapterTitle: document.metadata?.chapterTitle ?? undefined,
				mergePages: document.metadata?.mergePages ?? true,
			},
		},
	});

	const onSubmit = async (values: z.infer<typeof assetUpdateSchema>) => {
		toast.promise(updateAsset({ ...values, id: document.id }), {
			loading: "Updating document...",
			success: () => {
				router.history.back();
				return "Document updated successfully";
			},
			error: (error) => ({
				message: "Failed to update document",
				description: error.message,
			}),
		});
	};

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="flex flex-col gap-4"
			>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle>Document Metadata</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<FormField
								control={form.control}
								name="title"
								render={({ field }) => (
									<FormInputField
										field={field}
										label="Title"
										placeholder="Document title"
										inputType="text"
										description="The title of the document. This will be displayed in the student chat view."
									/>
								)}
							/>
							<FormField
								control={form.control}
								name="metadata.author"
								render={({ field }) => (
									<FormInputField
										field={field}
										label="Author(s)"
										placeholder="Author 1, Author 2..."
										inputType="text"
										description="A comma separated list of authors. This will be displayed in the student chat view."
									/>
								)}
							/>
							<FormField
								control={form.control}
								name="metadata.pageRange"
								render={({ field }) => (
									<FormInputField
										field={field}
										label="Page Range (If applicable)"
										placeholder="12-56"
										inputType="text"
										description="If the document is part of a larger work, you can specify the page range here. This will be displayed in the student chat view."
									/>
								)}
							/>
							<FormField
								control={form.control}
								name="metadata.chapterTitle"
								render={({ field }) => (
									<FormInputField
										field={field}
										label="Chapter Title (If applicable)"
										placeholder="Chapter 1: Introduction"
										inputType="text"
										description="If the document is a chapter in a book, you can specify the chapter title here. This will be displayed in the student chat view."
									/>
								)}
							/>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>Reference Settings</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<FormField
								control={form.control}
								name="metadata.citation"
								render={({ field }) => (
									<FormTextField
										field={field}
										label="Citation"
										placeholder="Citation"
										description="This citation will be displayed in the student chat view when the AI uses this document."
									/>
								)}
							/>
							<FormField
								control={form.control}
								name="metadata.externalUrl"
								render={({ field }) => (
									<FormInputField
										field={field}
										label="External URL"
										placeholder="moodle.com/course"
										inputType="text"
										description="This URL will be used to link to an external resource referencing the document in the student chat view, for example a deep link to your LMS."
									/>
								)}
							/>
							<FormField
								control={form.control}
								name="metadata.relevance"
								render={({ field }) => (
									<FormSelect
										field={field}
										options={[
											{ label: "High", value: "high" },
											{ label: "Medium", value: "medium" },
											{ label: "Low", value: "low" },
										]}
										placeholder="Select relevance"
										label="Relevance"
										description="Adjusts whether the document is used more frequently (scored higher) or less frequently (scored lower) in the AI's responses."
									/>
								)}
							/>
							<FormField
								control={form.control}
								name="metadata.showReference"
								render={({ field }) => (
									<FormSwitch
										field={field}
										label="Show Reference"
										description="Include a reference to this document in the student chat view when the AI uses it. When disabled, the AI can still use information from this document, but will not display a reference."
									/>
								)}
							/>
							<FormField
								control={form.control}
								name="metadata.mergePages"
								render={({ field }) => (
									<FormSwitch
										field={field}
										label="Merge Pages"
										description="If this is disabled, the document will be split on pages, instead of the AI trying to figure out semantically coherent chunks. Highly recommended for files like Presentations or content that is logically grouped on pages."
									/>
								)}
							/>
						</CardContent>
					</Card>
				</div>
				<Button type="submit">Save Document</Button>
			</form>
		</Form>
	);
};

export { DocumentForm };
