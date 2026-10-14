import type { InheritedAccess } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { GlobeIcon, Share2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { m } from "@/paraglide/messages";

/** Which of the two counts a phrase names, so the message picks its shape. */
const pairKind = <TFirst extends string, TSecond extends string>(
	first: number,
	second: number,
	names: {
		first: TFirst;
		second: TSecond;
	},
) =>
	first > 0 && second > 0 ? "both" : first > 0 ? names.first : names.second;

const ancestorPhrase = (inherited: InheritedAccess) =>
	m.access_inherited_ancestor_phrase({
		kind: pairKind(inherited.blockCount, inherited.botCount, {
			first: "blocks",
			second: "bots",
		}),
		blockCount: inherited.blockCount,
		botCount: inherited.botCount,
	});

const principalPhrase = (inherited: InheritedAccess) =>
	m.access_inherited_principal_phrase({
		kind: pairKind(inherited.groupCount, inherited.userCount, {
			first: "groups",
			second: "people",
		}),
		groupCount: inherited.groupCount,
		userCount: inherited.userCount,
	});

const InheritedAccessSummary = ({
	inherited,
}: {
	inherited: InheritedAccess;
}) => {
	const ancestorCount = inherited.botCount + inherited.blockCount;
	if (ancestorCount === 0) {
		return null;
	}

	const isShared = inherited.groupCount > 0 || inherited.userCount > 0;
	const ancestors = ancestorPhrase(inherited);
	const unnamed = ancestorCount - inherited.ancestors.length;

	return (
		<div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed p-3">
			<div className="flex min-w-0 flex-col gap-1">
				<div className="flex items-center gap-2">
					<Share2Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
					<p className="text-muted-foreground text-xs">
						{isShared
							? m.access_inherited_summary_shared({
									ancestors,
									principals: principalPhrase(inherited),
								})
							: m.access_inherited_summary_unshared({
									ancestors,
								})}
					</p>
				</div>
				{inherited.throughPublic && (
					<div className="flex items-center gap-2">
						<GlobeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
						<p className="text-muted-foreground text-xs">
							{m.access_inherited_public_note()}
						</p>
					</div>
				)}
			</div>

			<Popover>
				<PopoverTrigger
					render={
						<Button variant="outline" size="xs">
							{m.access_inherited_details_action()}
						</Button>
					}
				/>
				<PopoverContent align="end" className="w-80 gap-3">
					<div className="space-y-1">
						<p className="font-medium text-sm">
							{m.access_inherited_details_title()}
						</p>
						<p className="text-muted-foreground text-xs">
							{m.access_inherited_details_description()}
						</p>
					</div>

					<ScrollArea className="max-h-56">
						<ul className="space-y-1">
							{inherited.ancestors.map((ancestor) => (
								<li key={`${ancestor.resourceType}:${ancestor.resourceId}`}>
									<Link
										to={
											ancestor.resourceType === "bot"
												? "/app/hub/bots/$botId"
												: "/app/hub/blocks/$blockId"
										}
										params={
											ancestor.resourceType === "bot"
												? {
														botId: ancestor.resourceId,
													}
												: {
														blockId: ancestor.resourceId,
													}
										}
										className="block truncate rounded-lg px-2 py-1 text-sm hover:bg-muted"
									>
										{ancestor.name}
									</Link>
								</li>
							))}
						</ul>
					</ScrollArea>

					{unnamed > 0 && (
						<p className="text-muted-foreground text-xs">
							{inherited.hiddenAncestorCount > 0
								? m.access_inherited_unnamed_hidden({
										count: unnamed,
										hidden: inherited.hiddenAncestorCount,
									})
								: m.access_inherited_unnamed({
										count: unnamed,
									})}
						</p>
					)}
				</PopoverContent>
			</Popover>
		</div>
	);
};

export { InheritedAccessSummary };
