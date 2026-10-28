import {
	BookOpenIcon,
	CheckCircle2Icon,
	CpuIcon,
	FileTextIcon,
	LockKeyholeIcon,
	SparklesIcon,
} from "lucide-react";
import { m } from "@/paraglide/messages";

export const WIZARD_STEPS = [
	{
		key: "basics",
		title: m.authoring_wizard_step_basics_title,
		description: m.authoring_wizard_step_basics_description,
		icon: FileTextIcon,
	},
	{
		key: "behavior",
		title: m.authoring_wizard_step_behaviour_title,
		description: m.authoring_wizard_step_behaviour_description,
		icon: SparklesIcon,
	},
	{
		key: "documents",
		title: m.authoring_wizard_step_repositories_title,
		description: m.authoring_wizard_step_repositories_description,
		icon: BookOpenIcon,
	},
	{
		key: "sharing",
		title: m.authoring_wizard_step_sharing_title,
		description: m.authoring_wizard_step_sharing_description,
		icon: LockKeyholeIcon,
	},
	{
		key: "model",
		title: m.authoring_wizard_step_model_title,
		description: m.authoring_wizard_step_model_description,
		icon: CpuIcon,
	},
	{
		key: "review",
		title: m.authoring_wizard_step_review_title,
		description: m.authoring_wizard_step_review_description,
		icon: CheckCircle2Icon,
	},
] as const;

export const stepIndexOf = (key: (typeof WIZARD_STEPS)[number]["key"]) =>
	WIZARD_STEPS.findIndex((step) => step.key === key);

/** Where the bot's setup is edited, linked from notices and the detail page. */
export const MODEL_STEP_INDEX = stepIndexOf("model");
