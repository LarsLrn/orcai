import { qdrantPlaygroundSearchSchema } from "@orcai/schema";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAppForm } from "@/hooks/form";

const QdrantPlaygroundForm = () => {
	const { search, retrievalMode } = useSearch({
		from: "/app/hub/assets/playground",
	});
	const navigate = useNavigate();

	const form = useAppForm({
		defaultValues: {
			search: search ?? undefined,
			retrievalMode: retrievalMode ?? ("hybrid" as const),
		},
		validators: {
			onChange: qdrantPlaygroundSearchSchema,
		},
		onSubmit: async ({ value }) => {
			await navigate({
				to: ".",
				search: {
					search: value.search,
					retrievalMode: value.retrievalMode,
				},
			});
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
			noValidate
		>
			<form.AppField
				name="search"
				children={(field) => (
					<field.TextField
						label="Your search query"
						placeholder="Your search query..."
					/>
				)}
			/>

			<form.AppField
				name="retrievalMode"
				children={(field) => (
					<field.SelectField
						label="Retrieval Mode"
						options={[
							{
								label: "Hybrid",
								value: "hybrid",
							},
							{
								label: "Dense",
								value: "dense",
							},
							{
								label: "Sparse",
								value: "sparse",
							},
						]}
					/>
				)}
			/>

			<form.AppForm>
				<form.SubmitButton label="Search" />
			</form.AppForm>
		</form>
	);
};

export { QdrantPlaygroundForm };
