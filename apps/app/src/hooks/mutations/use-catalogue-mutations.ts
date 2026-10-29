import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** Adds a catalogue entry to the active organisation. */
export const useInstallMutation = (
	{
		name,
		organisation,
	}: {
		name: string;
		organisation: string;
	},
	opts: ReturnType<typeof orpc.catalogue.install.mutationOptions> = {},
) =>
	useMutationAction({
		mutationOptions: () => orpc.catalogue.install.mutationOptions(opts),
		messages: {
			loading: () =>
				m.catalogue_install_toast_loading({
					name,
				}),
			success: ({ data }) =>
				data.data.addedBlocks > 0
					? m.catalogue_install_toast_success_with_blocks({
							name,
							organisation,
							count: data.data.addedBlocks,
						})
					: m.catalogue_install_toast_success({
							name,
							organisation,
						}),
			error: () =>
				m.catalogue_install_toast_error({
					name,
				}),
		},
	});

/** Adds the blocks of a bot the active organisation added without them. */
export const useInstallBlocksMutation = ({
	name,
	organisation,
}: {
	name: string;
	organisation: string;
}) =>
	useMutationAction({
		mutationOptions: () => orpc.catalogue.installBlocks.mutationOptions(),
		messages: {
			loading: () =>
				m.catalogue_install_blocks_toast_loading({
					name,
				}),
			success: ({ data }) =>
				m.catalogue_install_blocks_toast_success({
					name,
					organisation,
					count: data.data.addedBlocks,
				}),
			error: () =>
				m.catalogue_install_blocks_toast_error({
					name,
				}),
		},
	});

/** Removes an entry added from the catalogue from the active organisation, after a confirm. */
export const useUninstallMutation = (
	{
		name,
		organisation,
	}: {
		name: string;
		organisation: string;
	},
	opts: ReturnType<typeof orpc.catalogue.uninstall.mutationOptions> = {},
) =>
	useMutationAction({
		mutationOptions: () => orpc.catalogue.uninstall.mutationOptions(opts),
		messages: {
			loading: () =>
				m.catalogue_uninstall_toast_loading({
					name,
				}),
			success: () =>
				m.catalogue_uninstall_toast_success({
					name,
					organisation,
				}),
			error: () =>
				m.catalogue_uninstall_toast_error({
					name,
				}),
		},
		confirm: () => ({
			title: m.catalogue_uninstall_confirm_title({
				name,
				organisation,
			}),
			description: m.catalogue_uninstall_confirm_description({
				organisation,
			}),
			confirmText: m.catalogue_uninstall_confirm_button(),
		}),
	});
