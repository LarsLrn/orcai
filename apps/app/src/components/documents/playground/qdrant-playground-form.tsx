import { qdrantPlaygroundSearchSchema } from "@orcai/schema";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAppForm } from "@/hooks/form";
import { m } from "@/paraglide/messages";

const QdrantPlaygroundForm = () => {
	const { search, retrievalMode } = useSearch({
		from: "/app/hub/repositories/$blockId/playground",
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
						label={m.assets_playground_search_label()}
						placeholder={m.assets_playground_search_placeholder()}
					/>
				)}
			/>

			<form.AppField
				name="retrievalMode"
				children={(field) => (
					<field.SelectField
						label={m.assets_playground_retrieval_mode_label()}
						options={[
							{
								label: m.blocks_retrieval_mode_hybrid_label(),
								value: "hybrid",
							},
							{
								label: m.blocks_retrieval_mode_dense_label(),
								value: "dense",
							},
							{
								label: m.blocks_retrieval_mode_sparse_label(),
								value: "sparse",
							},
						]}
					/>
				)}
			/>

			<form.AppForm>
				<form.SubmitButton label={m.assets_playground_submit_button()} />
			</form.AppForm>
		</form>
	);
};

export { QdrantPlaygroundForm };
