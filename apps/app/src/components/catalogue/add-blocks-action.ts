import type { CatalogueEntryDetail, CatalogueEntryRef } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { PackagePlusIcon } from "lucide-react";
import { useCatalogueAdder } from "@/components/catalogue/catalogue-adder";
import type { HeaderAction } from "@/components/ui/shell/actions";
import { useCatalogueAddBlocksMutation } from "@/hooks/mutations/use-catalogue-mutations";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const labels = {
	add: {
		behaviour: m.catalogue_add_blocks_behaviour,
		both: m.catalogue_add_blocks_both,
		repositories: m.catalogue_add_blocks_repositories,
	},
	also: {
		behaviour: m.catalogue_detail_add_blocks_behaviour,
		both: m.catalogue_detail_add_blocks_both,
		repositories: m.catalogue_detail_add_blocks_repositories,
	},
};

/** "Add its behaviour and N repositories to <org>", or "Also add" next to the bot. */
export const addBlocksLabel = (
	blocks: CatalogueEntryDetail["blocks"],
	organisation: string,
	wording: keyof typeof labels,
) => {
	const label = labels[wording];
	const behaviour = blocks.some((block) => block.type === "template");
	const count = blocks.filter((block) => block.type === "database").length;
	if (count === 0)
		return label.behaviour({
			organisation,
		});
	return (behaviour ? label.both : label.repositories)({
		organisation,
		count,
	});
};

/**
 * "Add its behaviour and N repositories" for a bot the organisation added
 * without them, while some are not added yet. Reads the bot's catalogue
 * entry, so only pages enable it.
 */
export const useAddBlocksAction = (
	entry: CatalogueEntryRef,
	name: string,
	{
		enabled,
		overflow = false,
	}: {
		enabled: boolean;
		overflow?: boolean;
	},
): HeaderAction | false => {
	const adder = useCatalogueAdder();
	const active = enabled && adder !== undefined && entry.resourceType === "bot";
	const { data } = useQuery({
		...orpc.catalogue.find.queryOptions({
			input: {
				entry,
			},
		}),
		enabled: active,
	});
	const { mutate, isPending } = useCatalogueAddBlocksMutation({
		name,
		organisation: adder?.organisation ?? "",
	});
	const blocks =
		data?.data.blocks.filter((block) => block.state === "available") ?? [];
	if (!active || data?.data.state !== "added" || !blocks.length) return false;

	return {
		key: "add-blocks",
		label: addBlocksLabel(blocks, adder.organisation, "add"),
		icon: PackagePlusIcon,
		overflow,
		loading: isPending,
		onClick: () => {
			if (entry.resourceType === "bot")
				mutate({
					botId: entry.resourceId,
				});
		},
	};
};
