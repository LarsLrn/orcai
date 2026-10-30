import {
	BotIcon,
	BoxesIcon,
	BrainCircuitIcon,
	DatabaseIcon,
	FactoryIcon,
	FileTextIcon,
	GraduationCapIcon,
	LockKeyholeIcon,
	type LucideIcon,
	MailIcon,
	NetworkIcon,
	ServerCogIcon,
	ShieldCheckIcon,
	SparklesIcon,
	UsersIcon,
} from "lucide-react";
import { siteConfig } from "@/lib/site-config";

export const pillars: Array<{
	title: string;
	description: string;
	icon: LucideIcon;
}> = [
	{
		title: "Grounded chat",
		description:
			"People ask questions in focused chats backed by selected sources instead of relying on generic model context.",
		icon: BrainCircuitIcon,
	},
	{
		title: "Reusable bots",
		description:
			"Teams compose bots from purpose, behaviour, repositories, sharing rules, and publication status.",
		icon: BotIcon,
	},
	{
		title: "Library",
		description:
			"Upload PDFs, Office files, text files, and images as assets with metadata for reuse across bots and chats.",
		icon: FileTextIcon,
	},
	{
		title: "Retrieval and citations",
		description:
			"Prepared assets are indexed for semantic retrieval so answers can cite the sources behind them.",
		icon: DatabaseIcon,
	},
	{
		title: "Controlled access",
		description:
			"Organisations manage groups, invitations, visibility, direct grants, and permission-gated administration.",
		icon: LockKeyholeIcon,
	},
	{
		title: "Self-hosted stack",
		description:
			"Run the full application, workers, storage, vector search, authorisation, and databases under your own control.",
		icon: ServerCogIcon,
	},
];

export const workflow = [
	"Upload files to a governed Library.",
	"Workers extract, prepare, and index assets for retrieval.",
	"Package assets into repositories with retrieval settings.",
	"Build bots from behaviours, repositories, model choices, and access policy.",
	"Users chat with bots that retrieve relevant context from the selected repositories.",
	"Admins manage providers, models, quota pools, groups, sharing, and operations.",
] as const;

export const audiences: Array<{
	label: string;
	value: string;
	icon: LucideIcon;
}> = [
	{
		label: "Specialist teams",
		value:
			"Turn internal documents, procedures, and domain references into bots for repeatable knowledge work.",
		icon: FactoryIcon,
	},
	{
		label: "Individuals",
		value:
			"Work against a curated personal or project repository without manually pasting context into every prompt.",
		icon: SparklesIcon,
	},
	{
		label: "Education",
		value:
			"Instructors can still create course-specific bots and learners can ask against selected sources.",
		icon: GraduationCapIcon,
	},
	{
		label: "Admins",
		value:
			"Keep model providers, quota pools, groups, access, and operational dependencies explicit.",
		icon: UsersIcon,
	},
	{
		label: "Research groups",
		value:
			"Experiment with retrieval-augmented workflows in a structured platform whose moving parts can be inspected.",
		icon: BoxesIcon,
	},
	{
		label: "Self-hosters",
		value:
			"Operate OrcAI with your own PostgreSQL, Valkey, S3-compatible storage, Qdrant, SpiceDB, and inference endpoint.",
		icon: ServerCogIcon,
	},
];

export const constraints = [
	"Open source application stack designed to run without external SaaS dependencies beyond an inference provider.",
	"Self-hosting is supported with Docker Compose or manually managed services.",
	"Governance is part of the product model: organisations, groups, grants, providers, models, quota pools, and workers are first-class concerns.",
	"Answer quality depends on the selected model, embedding configuration, indexed assets, and retrieval configuration.",
	"OrcAI is in active development and not yet presented as a production-hardened operations guide.",
	"Developed in the Sokratesᵗ and KI:edu.nrw applied project context at Rhine-Waal University.",
] as const;

export const stack = [
	"PostgreSQL",
	"Valkey",
	"S3-compatible storage",
	"Qdrant vector search",
	"SpiceDB authorisation",
	"Background workers",
	"OpenAI-compatible inference",
] as const;

export const governance = [
	{
		title: "Authorisation you can reason about",
		description:
			"Organisation context, permission-gated UI, groups, invitations, visibility settings, and grants on each bot, block and asset are built into the core workflows.",
		icon: ShieldCheckIcon,
	},
	{
		title: "Provider and quota control",
		description:
			"Admins can configure model providers, available models, quota pools, and the operational limits that shape AI access.",
		icon: ServerCogIcon,
	},
	{
		title: "Retrieval as infrastructure",
		description:
			"Asset preparation, object storage, workers, embeddings, and Qdrant indexes make repositories reusable rather than ad hoc chat attachments.",
		icon: NetworkIcon,
	},
] as const;

export const useCases = [
	"Course and seminar bots grounded in selected teaching material.",
	"Project repositories for teams working through technical, legal, policy, or research documents.",
	"Internal procedure bots that answer from approved operating manuals and reference material.",
	"Research prototypes for evaluating retrieval-augmented chat in controlled organisational settings.",
] as const;

export const primaryCta = {
	label: "Contact the OrcAI team",
	href: `mailto:${siteConfig.contactEmail}`,
	icon: MailIcon,
} as const;

export const secondaryCta = {
	label: "Read the docs",
	href: "/docs",
} as const;
