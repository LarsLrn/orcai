import type { BlockId } from "@orcai/core";
import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "@/components/ui/field";
import { hasCapability } from "@/lib/authz/capabilities";
import { formatList } from "@/lib/presentation/format-list";
import { m } from "@/paraglide/messages";

export type LinkedBlock = {
	id: BlockId;
	name: string;
	canManageAccess: boolean;
};

type BotBlock = {
	id?: BlockId;
	name: string;
	capabilities: Partial<Record<"manage_access", boolean>>;
};

/** The bot's saved template and repositories. */
export const toLinkedBlocks = (bot: {
	templateBlock: BotBlock | null;
	databaseBlocks: BotBlock[];
}): LinkedBlock[] =>
	[
		bot.templateBlock,
		...bot.databaseBlocks,
	].flatMap((block) =>
		block?.id
			? [
					{
						id: block.id,
						name: block.name,
						canManageAccess: hasCapability(block.capabilities, "manage_access"),
					},
				]
			: [],
	);

const BlockEditOffer = ({
	linkedBlocks,
	checked,
	onCheckedChange,
	disabled,
}: {
	linkedBlocks: LinkedBlock[];
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
}) => {
	const checkboxId = useId();
	const covered = linkedBlocks.filter((block) => block.canManageAccess);
	const hasUnmanaged = covered.length < linkedBlocks.length;

	return (
		<div className="mt-3 space-y-2">
			{covered.length > 0 ? (
				<Field orientation="horizontal">
					<Checkbox
						id={checkboxId}
						checked={checked}
						onCheckedChange={onCheckedChange}
						disabled={disabled}
					/>
					<FieldContent>
						<FieldLabel htmlFor={checkboxId} className="font-normal">
							{m.access_manager_block_edit_offer_label()}
						</FieldLabel>
						<FieldDescription className="text-xs">
							{m.access_manager_block_edit_offer_covers({
								names: formatList(covered.map((block) => block.name)),
							})}
						</FieldDescription>
					</FieldContent>
				</Field>
			) : null}
			{hasUnmanaged ? (
				<p className="text-muted-foreground text-xs">
					{m.access_manager_block_edit_offer_unmanaged()}
				</p>
			) : null}
		</div>
	);
};

export { BlockEditOffer };
