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

const count = (value: number, singular: string, plural = `${singular}s`) =>
	`${value} ${value === 1 ? singular : plural}`;

const joinCounts = (parts: (string | undefined)[]) =>
	parts.filter((part): part is string => part !== undefined).join(" and ");

const ancestorPhrase = (inherited: InheritedAccess) =>
	joinCounts([
		inherited.blockCount > 0 ? count(inherited.blockCount, "block") : undefined,
		inherited.botCount > 0 ? count(inherited.botCount, "bot") : undefined,
	]);

const principalPhrase = (inherited: InheritedAccess) =>
	joinCounts([
		inherited.groupCount > 0 ? count(inherited.groupCount, "group") : undefined,
		inherited.userCount > 0
			? count(inherited.userCount, "person", "people")
			: undefined,
	]);

const InheritedAccessSummary = ({
	inherited,
}: {
	inherited: InheritedAccess;
}) => {
	const ancestorCount = inherited.botCount + inherited.blockCount;
	if (ancestorCount === 0) {
		return null;
	}

	const shared = principalPhrase(inherited);
	const unnamed = ancestorCount - inherited.ancestors.length;

	return (
		<div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed p-3">
			<div className="flex min-w-0 flex-col gap-1">
				<div className="flex items-center gap-2">
					<Share2Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
					<p className="text-muted-foreground text-xs">
						{shared
							? `Also shared through ${ancestorPhrase(inherited)} with ${shared}.`
							: `Also reachable through ${ancestorPhrase(inherited)}, not shared with anyone yet.`}
					</p>
				</div>
				{inherited.throughPublic && (
					<div className="flex items-center gap-2">
						<GlobeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
						<p className="text-muted-foreground text-xs">
							One of them is public, so everyone on this instance can read this
							resource.
						</p>
					</div>
				)}
			</div>

			<Popover>
				<PopoverTrigger
					render={
						<Button variant="outline" size="xs">
							See details
						</Button>
					}
				/>
				<PopoverContent align="end" className="w-80 gap-3">
					<div className="space-y-1">
						<p className="font-medium text-sm">Inherited access</p>
						<p className="text-muted-foreground text-xs">
							These grants are set on the bot or block itself. Open one to
							change them.
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
							{count(unnamed, "more is", "more are")} not listed
							{inherited.hiddenAncestorCount > 0
								? `, ${count(inherited.hiddenAncestorCount, "of which", "of which")} you cannot open.`
								: "."}
						</p>
					)}
				</PopoverContent>
			</Popover>
		</div>
	);
};

export { InheritedAccessSummary };
