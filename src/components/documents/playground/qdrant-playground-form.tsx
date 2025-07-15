"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { FormInputField } from "@/components/forms/fields/formInputField";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
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

	const onSubmit = (values: QdrantPlaygroundSearchSchemaType) => {
		navigate({ to: ".", search: { search: values.search } });
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
				<FormField
					control={form.control}
					name="search"
					render={({ field }) => (
						<FormInputField
							className="w-full"
							field={field}
							placeholder="Your search query..."
							inputType="text"
						/>
					)}
				/>
				<Button type="submit" /* disabled={isLoading} */>Search</Button>
			</form>
		</Form>
	);
};

export { QdrantPlaygroundForm };
