import { zodResolver } from "@hookform/resolvers/zod";
import {
	skipToken,
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod/v4";
/* import { BlockEditor } from "@/components/editor"; */
import { FormSelectField } from "@/components/forms/fields/form-select-field";
import { FormTextField } from "@/components/forms/fields/form-text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import type { Block } from "@/db/schema/block";
import { blockInsertSchema } from "@/lib/orpc/contracts/block";
import { orpc } from "@/lib/orpc/orpc";
import { FormInputField } from "../forms/fields/form-input-field";

const BlockForm = ({ block }: { block?: Block }) => {
	const queryClient = useQueryClient();
	const router = useRouter();
	const { auth } = useRouteContext({ from: "/app" });

	const { data: providers } = useSuspenseQuery(
		orpc.organizationProvider.list.queryOptions({
			input: { organizationId: auth.session.activeOrganizationId },
			queryKey: orpc.organizationProvider.list.key({
				input: { organizationId: auth.session.activeOrganizationId },
			}),
		}),
	);

	const { mutateAsync: updateBlock } = useMutation(
		orpc.block.update.mutationOptions({
			onSuccess() {
				queryClient.invalidateQueries({
					queryKey: orpc.block.key(),
				});
			},
		}),
	);

	const { mutateAsync: createBlock } = useMutation(
		orpc.block.create.mutationOptions({
			onSuccess() {
				queryClient.invalidateQueries({
					queryKey: orpc.block.key(),
				});
			},
		}),
	);

	const form = useForm<z.infer<typeof blockInsertSchema>>({
		resolver: zodResolver(blockInsertSchema),
		defaultValues: {
			name: block?.name ?? undefined,
			type: block?.type ?? undefined,
			config: {
				systemPrompt: block?.config?.systemPrompt ?? "",
				maxReferences: block?.config?.maxReferences ?? 5,
				model: block?.config?.model ?? "",
				provider: block?.config?.provider ?? "",
			},
		},
	});

	const providerSlug = form.watch("config.provider");

	const { data: models, status: modelsStatus } = useQuery(
		orpc.model.list.queryOptions({
			input: providerSlug ? { providerSlug } : skipToken,
			queryKey: orpc.model.list.key({
				input: { providerSlug },
			}),
		}),
	);

	const onSubmit = (values: z.infer<typeof blockInsertSchema>) => {
		if (block) {
			toast.promise(
				updateBlock({
					...values,
					id: block.id,
				}),
				{
					loading: "Updating block...",
					success: () => {
						router.history.back();
						return "Block updated successfully";
					},
					error: (error) => ({
						message: "Failed to update block",
						description: error.message,
					}),
				},
			);
		} else {
			toast.promise(createBlock(values), {
				loading: "Creating block...",
				success: (result) => {
					router.navigate({
						to: "/app/blocks/$blockId",
						params: { blockId: result.data.id },
					});
					return "Block created successfully";
				},
				error: (error) => ({
					message: "Failed to create block",
					description: error.message,
				}),
			});
		}
	};
	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
					<Card className="lg:col-span-2">
						<CardContent className="flex flex-col gap-4 p-6">
							<FormInputField
								form={form}
								name="name"
								inputType="text"
								placeholder="Block name"
								label="Name"
								required={true}
							/>

							<FormSelectField
								form={form}
								name="type"
								options={[
									{ value: "database", label: "Database" },
									{ value: "template", label: "Template" },
								]}
								label="Type"
								placeholder="Choose a Block Type"
								required={true}
							/>
						</CardContent>
					</Card>
					<Card className="h-fit">
						<CardHeader>
							<CardTitle>Block AI Settings</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<div className="grid w-full gap-1.5">
								<FormSelectField
									form={form}
									name="config.provider"
									options={providers.data.map((provider) => ({
										value: provider.providerSlug,
										label: provider.providerSlug,
									}))}
									label="Provider"
									placeholder="Choose a Provider"
									required={false}
									onValueChange={() => {
										form.setValue("config.model", undefined);
									}}
								/>

								<FormSelectField
									form={form}
									name="config.model"
									options={models?.data?.map((model) => ({
										value: model.slug,
										label: model.name,
									}))}
									label="Model"
									placeholder="Choose an AI Model"
									required={false}
									disabled={!providerSlug || modelsStatus !== "success"}
								/>
							</div>

							<div className="grid w-full gap-1.5">
								<FormTextField
									form={form}
									name={"config.systemPrompt"}
									rows={10}
									label="System Prompt"
									placeholder="Your custom system prompt..."
									required={false}
								/>
							</div>

							<div>
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
							</div>
						</CardContent>
					</Card>
				</div>
				<Button type="submit">Save Block</Button>
			</form>
		</Form>
	);
};

export { BlockForm };
