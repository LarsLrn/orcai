import {
	BotIcon,
	BrainCircuitIcon,
	DatabaseIcon,
	FileTextIcon,
	type LucideIcon,
} from "lucide-react";
import type { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages";

export type ResourceKind = "bot" | "behaviour" | "repository" | "asset";

/** How a resource kind looks: its name, glyph, badge, icon well and band tint. */
export const RESOURCE_KINDS = {
	bot: {
		label: m.resource_kind_bot,
		badge: "kind-bot",
		Icon: BotIcon,
		well: "bg-kind-bot/12 text-kind-bot dark:bg-kind-bot/20",
		band: "from-kind-bot/35 via-kind-bot/15 to-accent-brand/20",
	},
	behaviour: {
		label: m.resource_kind_behaviour,
		badge: "kind-behaviour",
		Icon: BrainCircuitIcon,
		well: "bg-kind-behaviour/12 text-kind-behaviour dark:bg-kind-behaviour/20",
		band: "from-kind-behaviour/35 via-kind-behaviour/15 to-accent-brand/20",
	},
	repository: {
		label: m.resource_kind_repository,
		badge: "kind-repository",
		Icon: DatabaseIcon,
		well: "bg-kind-repository/12 text-kind-repository dark:bg-kind-repository/20",
		band: "from-kind-repository/35 via-kind-repository/15 to-accent-brand/20",
	},
	asset: {
		label: m.resource_kind_asset,
		badge: "kind-asset",
		Icon: FileTextIcon,
		well: "bg-kind-asset/12 text-kind-asset dark:bg-kind-asset/20",
		band: "from-kind-asset/35 via-kind-asset/15 to-accent-brand/20",
	},
} satisfies Record<
	ResourceKind,
	{
		label: () => string;
		badge: React.ComponentProps<typeof Badge>["variant"];
		Icon: LucideIcon;
		well: string;
		band: string;
	}
>;
