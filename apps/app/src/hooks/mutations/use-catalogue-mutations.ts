import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** Adds a catalogue entry to the active organisation. */
export const useCatalogueAddMutation = (
	{
		name,
		organisation,
	}: {
		name: string;
		organisation: string;
	},
	opts: ReturnType<typeof orpc.catalogue.add.mutationOptions> = {},
) =>
	useMutationAction({
		mutationOptions: () => orpc.catalogue.add.mutationOptions(opts),
		messages: {
			loading: () =>
				m.catalogue_add_toast_loading({
					name,
				}),
			success: ({ data }) =>
				data.data.addedBlocks > 0
					? m.catalogue_add_toast_success_with_blocks({
							name,
							organisation,
							count: data.data.addedBlocks,
						})
					: m.catalogue_add_toast_success({
							name,
							organisation,
						}),
			error: () =>
				m.catalogue_add_toast_error({
					name,
				}),
		},
	});

/** Adds the blocks of a bot the active organisation added without them. */
export const useCatalogueAddBlocksMutation = ({
	name,
	organisation,
}: {
	name: string;
	organisation: string;
}) =>
	useMutationAction({
		mutationOptions: () => orpc.catalogue.addBlocks.mutationOptions(),
		messages: {
			loading: () =>
				m.catalogue_add_blocks_toast_loading({
					name,
				}),
			success: ({ data }) =>
				m.catalogue_add_blocks_toast_success({
					name,
					organisation,
					count: data.data.addedBlocks,
				}),
			error: () =>
				m.catalogue_add_blocks_toast_error({
					name,
				}),
		},
	});

/** Removes an entry added from the catalogue from the active organisation, after a confirm. */
export const useCatalogueRemoveMutation = (
	{
		kind,
		name,
		organisation,
	}: {
		kind: "bot" | "block";
		name: string;
		organisation: string;
	},
	opts: ReturnType<typeof orpc.catalogue.remove.mutationOptions> = {},
) =>
	useMutationAction({
		mutationOptions: () => orpc.catalogue.remove.mutationOptions(opts),
		messages: {
			loading: () =>
				m.catalogue_remove_toast_loading({
					name,
				}),
			success: () =>
				m.catalogue_remove_toast_success({
					name,
					organisation,
				}),
			error: () =>
				m.catalogue_remove_toast_error({
					name,
				}),
		},
		confirm: () => ({
			title: m.catalogue_remove_confirm_title({
				name,
				organisation,
			}),
			description: (kind === "bot"
				? m.catalogue_remove_confirm_description_bot
				: m.catalogue_remove_confirm_description_block)({
				organisation,
			}),
			confirmText: m.catalogue_remove_confirm_button(),
		}),
	});
