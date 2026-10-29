import type { Group } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useAppForm } from "@/hooks/form";
import {
	useDeleteGroupsMutation,
	useUpdateGroupMutation,
} from "@/hooks/mutations/use-group-mutations";
import { m } from "@/paraglide/messages";

const GroupSettingsForm = ({ group }: { group: Group }) => {
	const navigate = useNavigate();
	const updateGroup = useUpdateGroupMutation();
	const deleteGroup = useDeleteGroupsMutation(
		{
			onSuccess: async () => {
				await navigate({
					to: "/app/groups",
				});
			},
		},
		{
			names: [
				group.name,
			],
		},
	);

	const isSystemGroup = group.kind === "system";

	const form = useAppForm({
		defaultValues: {
			name: group.name,
			description: group.description ?? "",
		},
		onSubmit: async ({ value }) => {
			await updateGroup.mutateAsync({
				id: group.id,
				name: value.name.trim(),
				description: value.description.trim() ? value.description.trim() : null,
			});
		},
	});
	const isNameBlank = useSelector(
		form.store,
		(state) => !state.values.name.trim(),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.groups_settings_card_title()}</CardTitle>
				<CardDescription>
					{isSystemGroup
						? m.groups_settings_card_description_system()
						: m.groups_settings_card_description_custom()}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					className="flex flex-col gap-5"
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
				>
					<form.AppField
						name="name"
						children={(field) => (
							<field.TextField
								label={m.common_name_label()}
								width="medium"
								disabled={isSystemGroup}
							/>
						)}
					/>
					<form.AppField
						name="description"
						children={(field) => (
							<field.TextareaField
								label={m.common_description_label()}
								rows={3}
								disabled={isSystemGroup}
							/>
						)}
					/>
					<div className="flex justify-end gap-2">
						{!isSystemGroup && (
							<Button
								type="button"
								variant="destructive"
								loading={deleteGroup.isPending}
								onClick={() =>
									deleteGroup.mutate({
										refs: [
											{
												id: group.id,
											},
										],
									})
								}
							>
								<Trash2Icon />
								{m.groups_delete_action()}
							</Button>
						)}
						<form.AppForm>
							<form.SubmitButton
								label={m.common_save_button()}
								disabled={isSystemGroup || isNameBlank}
							/>
						</form.AppForm>
					</div>
				</form>
			</CardContent>
		</Card>
	);
};

export { GroupSettingsForm };
