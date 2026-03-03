import { useNavigate, useSearch } from "@tanstack/react-router";
import { qdrantPlaygroundSearchSchema } from "@/db/zod/qdrant";
import { useAppForm } from "@/hooks/form";

const QdrantPlaygroundForm = () => {
	const { search } = useSearch({ from: "/app/hub/assets/playground" });
	const navigate = useNavigate();

	const form = useAppForm({
		defaultValues: {
			search: search ?? undefined,
		},
		validators: {
			onChange: qdrantPlaygroundSearchSchema,
		},
		onSubmit: async ({ value }) => {
			await navigate({ to: ".", search: { search: value.search } });
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
					<field.TextField label="Search" placeholder="Your search query..." />
				)}
			/>

			<form.AppForm>
				<form.SubmitButton label="Save Block" />
			</form.AppForm>
		</form>
	);
};

export { QdrantPlaygroundForm };
