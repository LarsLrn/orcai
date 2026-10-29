import type { Block } from "@orcai/schema";
import {
	BotIcon,
	BrainCircuitIcon,
	DatabaseIcon,
	FileTextIcon,
	type LucideIcon,
} from "lucide-react";

type ResourceKind = "bot" | "behaviour" | "repository" | "asset";

/** How a resource kind looks: its glyph, its icon well and its band tint. */
export const RESOURCE_KINDS = {
	bot: {
		Icon: BotIcon,
		well: "bg-kind-bot/12 text-kind-bot dark:bg-kind-bot/20",
		band: "from-kind-bot/35 via-kind-bot/15 to-accent-brand/20",
	},
	behaviour: {
		Icon: BrainCircuitIcon,
		well: "bg-kind-behaviour/12 text-kind-behaviour dark:bg-kind-behaviour/20",
		band: "from-kind-behaviour/35 via-kind-behaviour/15 to-accent-brand/20",
	},
	repository: {
		Icon: DatabaseIcon,
		well: "bg-kind-repository/12 text-kind-repository dark:bg-kind-repository/20",
		band: "from-kind-repository/35 via-kind-repository/15 to-accent-brand/20",
	},
	asset: {
		Icon: FileTextIcon,
		well: "bg-kind-asset/12 text-kind-asset dark:bg-kind-asset/20",
		band: "from-kind-asset/35 via-kind-asset/15 to-accent-brand/20",
	},
} satisfies Record<
	ResourceKind,
	{
		Icon: LucideIcon;
		well: string;
		band: string;
	}
>;

export const blockKind = (type: Block["type"]) =>
	type === "template" ? "behaviour" : "repository";
