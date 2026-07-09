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

export const contactEmail = "sokratest@hochschule-rhein-waal.de";

export const pillars: Array<{
	title: string;
	description: string;
	icon: LucideIcon;
}> = [
	{
		title: "Grounded chat",
		description:
			"People ask questions in focused chats backed by selected source material instead of relying on generic model context.",
		icon: BrainCircuitIcon,
	},
	{
		title: "Reusable assistants",
		description:
			"Teams compose bots from purpose, response behaviour, retrieval repositories, sharing rules, and publication status.",
		icon: BotIcon,
	},
	{
		title: "Content library",
		description:
			"Upload documents, Office files, PDFs, images, and metadata-backed source items for reuse across bots and chats.",
		icon: FileTextIcon,
	},
	{
		title: "Retrieval and citations",
		description:
			"Processed material is indexed for semantic retrieval so answers can refer back to the knowledge base behind them.",
		icon: DatabaseIcon,
	},
	{
		title: "Controlled access",
		description:
			"Organizations manage groups, invitations, visibility, direct grants, and capability-gated administration.",
		icon: LockKeyholeIcon,
	},
	{
		title: "Self-hosted stack",
		description:
			"Run the full application, workers, storage, vector search, authorization, and databases under your own control.",
		icon: ServerCogIcon,
	},
];

export const workflow = [
	"Add source material to a governed content library.",
	"Workers extract, process, and index content for retrieval.",
	"Package material into repository blocks with retrieval settings.",
	"Build assistants from behaviour rules, repositories, model choices, and access policy.",
	"Users chat with assistants that retrieve relevant context from the selected knowledge base.",
	"Admins manage providers, models, quotas, groups, sharing, and operations.",
] as const;

export const audiences: Array<{
	label: string;
	value: string;
	icon: LucideIcon;
}> = [
	{
		label: "Specialist teams",
		value:
			"Turn internal documents, procedures, and domain references into assistants for repeatable knowledge work.",
		icon: FactoryIcon,
	},
	{
		label: "Individuals",
		value:
			"Work against a curated personal or project knowledge base without manually pasting context into every prompt.",
		icon: SparklesIcon,
	},
	{
		label: "Education",
		value:
			"Instructors can still create course-specific assistants and learners can ask against selected material.",
		icon: GraduationCapIcon,
	},
	{
		label: "Administrators",
		value:
			"Keep model providers, quotas, groups, resource access, and operational dependencies explicit.",
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
	"Governance is part of the product model: organizations, groups, grants, providers, models, quotas, and workers are first-class concerns.",
	"Answer quality depends on the selected model, embedding configuration, indexed material, and retrieval setup.",
	"OrcAI is in active development and not yet presented as a production-hardened operations guide.",
	"Developed in the Sokratesᵗ and KI:edu.nrw applied project context at Rhine-Waal University.",
] as const;

export const stack = [
	"PostgreSQL",
	"Valkey",
	"S3-compatible storage",
	"Qdrant vector search",
	"SpiceDB authorization",
	"Background workers",
	"OpenAI-compatible inference",
] as const;

export const governance = [
	{
		title: "Authorization you can reason about",
		description:
			"Organization context, capability-gated UI, groups, invitations, visibility settings, and resource-level grants are built into the core workflows.",
		icon: ShieldCheckIcon,
	},
	{
		title: "Provider and quota control",
		description:
			"Admins can configure model providers, available models, usage quotas, and the operational limits that shape AI access.",
		icon: ServerCogIcon,
	},
	{
		title: "Retrieval as infrastructure",
		description:
			"Content ingestion, object storage, workers, embeddings, and Qdrant indexes make knowledge bases reusable rather than ad hoc chat attachments.",
		icon: NetworkIcon,
	},
] as const;

export const useCases = [
	"Course and seminar assistants grounded in selected teaching material.",
	"Project knowledge bases for teams working through technical, legal, policy, or research documents.",
	"Internal procedure assistants that answer from approved operating manuals and reference material.",
	"Research prototypes for evaluating retrieval-augmented chat in controlled organizational settings.",
] as const;

export const primaryCta = {
	label: "Contact the OrcAI team",
	href: `mailto:${contactEmail}`,
	icon: MailIcon,
} as const;

export const secondaryCta = {
	label: "Read the docs",
	href: "/docs",
} as const;
