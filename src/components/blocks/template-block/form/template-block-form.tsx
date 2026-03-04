import { useStore } from "@tanstack/react-form";
import { skipToken, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppForm } from "@/hooks/form";
import {
	useCreateBlockMutation,
	useUpdateBlockMutation,
} from "@/hooks/mutations/use-block-mutations";
import { orpc } from "@/lib/orpc/orpc";
import type { TemplateBlock } from "@/lib/orpc/schemas/block";
import { templateBlockFormOptions } from "./template-block-form-options";

const TemplateBlockForm = ({
	action,
	block,
}: {
	action: "create" | "update";
	block?: TemplateBlock;
}) => {
	const { mutate: createBlock } = useCreateBlockMutation();
	const { mutate: updateBlock } = useUpdateBlockMutation();

	const { auth } = useRouteContext({ from: "/app" });

	const { data: providers } = useSuspenseQuery(
		orpc.provider.list.queryOptions({
			input: { organizationId: auth.session.activeOrganizationId },
		}),
	);

	const form = useAppForm({
		...templateBlockFormOptions(block),
		onSubmit: ({ value }) => {
			if (action === "update" && block) {
				updateBlock({ ...value, id: block.id });
			} else {
				createBlock(value);
			}
		},
	});

	const providerId = useStore(
		form.store,
		(state) => state.values.config.provider,
	);

	const { data: models } = useQuery(
		orpc.model.list.queryOptions({
			input: providerId
				? { filters: { providerId, capabilities: ["text"] } }
				: skipToken,
		}),
	);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
			noValidate
		>
			<form.AppForm>
				<form.FormValidationErrors />
			</form.AppForm>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardContent className="flex flex-col gap-4 p-6">
						<form.AppField
							name="name"
							children={(field) => (
								<field.TextField label="Name" placeholder="Block name" />
							)}
						/>
					</CardContent>
				</Card>
				<Card className="h-fit">
					<CardHeader>
						<CardTitle>Block AI Settings</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<form.AppField
							name="config.provider"
							listeners={{
								onChange: () => form.setFieldValue("config.model", ""),
							}}
							children={(field) => (
								<field.SelectField
									label="Provider"
									placeholder="Choose a Provider"
									options={providers.data.map((provider) => ({
										value: provider.id,
										label: provider.name,
									}))}
								/>
							)}
						/>

						<form.AppField
							name="config.model"
							children={(field) => (
								<field.SelectField
									label="AI Model"
									placeholder="Choose an AI Model"
									options={models?.data?.map((model) => ({
										value: model.id,
										label: model.name,
									}))}
								/>
							)}
						/>

						<form.AppField
							name="config.systemPrompt"
							children={(field) => (
								<field.TextareaField
									label="System Prompt"
									placeholder="Your custom system prompt..."
								/>
							)}
						/>
					</CardContent>
				</Card>
			</div>
			<form.AppForm>
				<form.SubmitButton label="Save Block" />
			</form.AppForm>
		</form>
	);
};

export { TemplateBlockForm };
