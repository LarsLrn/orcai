import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { FormInputField } from "@/components/forms/fields/form-input-field";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
	type QdrantPlaygroundSearchSchemaType,
	qdrantPlaygroundSearchSchema,
} from "@/db/zod/qdrant";

const QdrantPlaygroundForm = () => {
	const { search } = useSearch({ from: "/app/(assets)/assets/playground" });
	const navigate = useNavigate();

	const form = useForm<QdrantPlaygroundSearchSchemaType>({
		resolver: zodResolver(qdrantPlaygroundSearchSchema),
		defaultValues: {
			search: search ?? undefined,
		},
	});

	const onSubmit = async (values: QdrantPlaygroundSearchSchemaType) => {
		await navigate({ to: ".", search: { search: values.search } });
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
				<FormInputField
					form={form}
					name="search"
					className="w-full"
					placeholder="Your search query..."
					inputType="text"
				/>

				<Button type="submit" /* disabled={isLoading} */>Search</Button>
			</form>
		</Form>
	);
};

export { QdrantPlaygroundForm };
