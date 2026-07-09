import {
	BotIcon,
	CheckCircle2Icon,
	DatabaseIcon,
	FileTextIcon,
	ServerCogIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

export const ConsoleVisual = ({ className }: { className?: string }) => (
	<div
		role="img"
		aria-label="Governed knowledge assistant operations console visualization"
		className={cn(
			"rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-white shadow-2xl shadow-neutral-950/30",
			className,
		)}
	>
		<div className="mb-4 flex items-center justify-between border-neutral-800 border-b pb-3">
			<div>
				<div className="font-medium">Workspace control</div>
				<div className="text-neutral-400 text-xs">
					Knowledge assistant configuration
				</div>
			</div>
			<div className="rounded-full bg-lime-300 px-2 py-1 font-medium text-lime-950 text-xs">
				Indexed
			</div>
		</div>
		<div className="grid gap-3 sm:grid-cols-2">
			{[
				[
					"Assistants",
					"18 configured",
					BotIcon,
				],
				[
					"Content",
					"246 source items",
					FileTextIcon,
				],
				[
					"Repositories",
					"8 retrieval sets",
					DatabaseIcon,
				],
				[
					"Providers",
					"3 model endpoints",
					ServerCogIcon,
				],
			].map(([label, value, Icon]) => (
				<div
					key={label as string}
					className="rounded-lg border border-neutral-800 bg-neutral-900 p-4"
				>
					<div className="mb-5 flex items-center justify-between">
						<Icon className="size-5 text-lime-300" />
						<div className="h-2 w-16 rounded-full bg-neutral-800" />
					</div>
					<div className="font-medium">{label as string}</div>
					<div className="text-neutral-400 text-sm">{value as string}</div>
				</div>
			))}
		</div>
		<div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
			<div className="mb-3 flex items-center gap-2 text-sm">
				<CheckCircle2Icon className="size-4 text-lime-300" />
				Ready for governed access
			</div>
			<div className="grid grid-cols-5 gap-2">
				{Array.from({
					length: 15,
				}).map((_, index) => (
					<div
						key={index}
						className={cn(
							"h-2 rounded-full",
							index % 4 === 0 ? "bg-lime-300" : "bg-neutral-700",
						)}
					/>
				))}
			</div>
		</div>
	</div>
);
