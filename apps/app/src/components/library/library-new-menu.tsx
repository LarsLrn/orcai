import type { OrganizationCapability } from "@orcai/schema";
import { Link, type LinkProps } from "@tanstack/react-router";
import { type LucideIcon, PlusIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLinkItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	filterByCapabilities,
	useOrganizationCapabilities,
} from "@/hooks/authz/use-capabilities";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { m } from "@/paraglide/messages";

const NEW_ITEMS: {
	key: string;
	label: () => string;
	Icon: LucideIcon;
	tone: string;
	requires: OrganizationCapability;
	linkProps: LinkProps;
}[] = [
	{
		key: "bot",
		label: m.library_new_bot_action,
		Icon: RESOURCE_KINDS.bot.Icon,
		tone: "text-kind-bot",
		requires: "create_bot",
		linkProps: {
			to: "/app/library/bots/add",
		},
	},
	{
		key: "behaviour",
		label: m.library_new_behaviour_action,
		Icon: RESOURCE_KINDS.behaviour.Icon,
		tone: "text-kind-behaviour",
		requires: "create_block",
		linkProps: {
			to: "/app/library/behaviours/add",
		},
	},
	{
		key: "repository",
		label: m.library_new_repository_action,
		Icon: RESOURCE_KINDS.repository.Icon,
		tone: "text-kind-repository",
		requires: "create_block",
		linkProps: {
			to: "/app/library/repositories/add",
		},
	},
	{
		key: "upload",
		label: m.library_new_upload_action,
		Icon: UploadIcon,
		tone: "text-kind-asset",
		requires: "create_asset",
		linkProps: {
			to: "/app/library/assets/add",
		},
	},
];

/** Everything the user may create in the library, in one menu; nothing without a `create_*` capability. */
export const LibraryNewMenu = () => {
	const { data } = useOrganizationCapabilities([
		"create_bot",
		"create_block",
		"create_asset",
	]);
	const items = filterByCapabilities(
		NEW_ITEMS,
		data?.data.capabilities,
		(item) => item.requires,
	);
	if (items.length === 0) return null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button className="shrink-0" />}>
				<PlusIcon data-icon="inline-start" aria-hidden="true" />
				{m.library_new_action()}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				{items.map((item) => (
					<DropdownMenuLinkItem
						key={item.key}
						render={<Link {...item.linkProps} />}
					>
						<item.Icon aria-hidden="true" className={item.tone} />
						{item.label()}
					</DropdownMenuLinkItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
