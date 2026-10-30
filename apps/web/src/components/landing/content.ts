import {
	ActivityIcon,
	BarChart3Icon,
	BookOpenCheckIcon,
	FileSearchIcon,
	FingerprintIcon,
	GitBranchIcon,
	LanguagesIcon,
	ListChecksIcon,
	type LucideIcon,
	MailIcon,
	PlugIcon,
	UsersIcon,
	WalletIcon,
} from "lucide-react";
import { siteConfig } from "@/lib/site-config";
import assistantPlanDark from "@/static/landing/assistant-plan-dark.webp";
import assistantPlanLight from "@/static/landing/assistant-plan-light.webp";
import chatCitationsDark from "@/static/landing/chat-citations-dark.webp";
import chatCitationsLight from "@/static/landing/chat-citations-light.webp";
import citationOpenDark from "@/static/landing/citation-open-dark.webp";
import citationOpenLight from "@/static/landing/citation-open-light.webp";
import libraryDark from "@/static/landing/library-dark.webp";
import libraryLight from "@/static/landing/library-light.webp";
import quizDark from "@/static/landing/quiz-dark.webp";
import quizLight from "@/static/landing/quiz-light.webp";

export type Screenshot = {
	light: string;
	dark: string;
	width: number;
	height: number;
	alt: string;
};

export const heroScreenshot: Screenshot = {
	light: chatCitationsLight,
	dark: chatCitationsDark,
	width: 1620,
	height: 1246,
	alt: "A chat with the Citation coach bot. It explains how to cite a book chapter in APA 7, and each statement carries a citation of the library's APA referencing guide.",
};

export const features: Array<{
	eyebrow: string;
	title: string;
	description: string;
	screenshot: Screenshot;
}> = [
	{
		eyebrow: "Chat",
		title: "Answers that show where they come from.",
		description:
			"A bot searches its repositories for the passages that match a question and cites them in its answer. Each citation names the asset and links to it. With web search on, a bot also lists the web pages it used.",
		screenshot: {
			light: citationOpenLight,
			dark: citationOpenDark,
			width: 1620,
			height: 677,
			alt: "An opened citation in a chat answer. It shows the asset's title, source type, author and APA citation label, with an Open asset link.",
		},
	},
	{
		eyebrow: "Questions and quizzes",
		title: "Practise with quizzes the bot grades.",
		description:
			"A bot can ask structured questions in the chat and run quizzes on its material. After you submit, it grades every answer, explains what you missed and offers practice on it. Generative UI adds checklists, reviews and comparison tables to its answers.",
		screenshot: {
			light: quizLight,
			dark: quizDark,
			width: 1598,
			height: 1159,
			alt: "A quiz on APA 7 in-text citations in a chat, with multiple-choice questions grouped under the section Author rules.",
		},
	},
	{
		eyebrow: "OrcAI Assistant",
		title: "Set up bots by describing them.",
		description:
			"The OrcAI Assistant creates bots, behaviours and repositories, asks you for files and writes their metadata. It proposes a plan for you to approve and asks again before it deletes something or changes access. It acts with your own permissions and answers questions about OrcAI from its documentation.",
		screenshot: {
			light: assistantPlanLight,
			dark: assistantPlanDark,
			width: 1505,
			height: 468,
			alt: "The OrcAI Assistant proposes a plan to create a Statistics helper bot and waits for approval, with Revise and Approve plan buttons.",
		},
	},
	{
		eyebrow: "Library and Catalogue",
		title: "Build a bot from parts you reuse.",
		description:
			"A bot combines a behaviour, which decides how it writes, with repositories, which hold the assets it answers from. Both live in the Library and work in any number of bots. Share them with members and groups, or list them in the Catalogue so other organisations on the instance can add them.",
		screenshot: {
			light: libraryLight,
			dark: libraryDark,
			width: 2333,
			height: 1066,
			alt: "The Library overview with the bots Essay planner and Citation coach and their features, next to the counts of bots, behaviours, repositories and assets.",
		},
	},
];

export const moreFeatures: Array<{
	text: string;
	icon: LucideIcon;
}> = [
	{
		text: "The utility model suggests titles, descriptions and APA citation labels for new assets.",
		icon: FileSearchIcon,
	},
	{
		text: "Activity follows uploads, preparation and exports, and shows what needs you.",
		icon: ActivityIcon,
	},
	{
		text: "Organisation roles, groups and sharing decide who sees and edits each bot, block and asset.",
		icon: UsersIcon,
	},
	{
		text: "Quota pools give groups a budget for model use in each period.",
		icon: WalletIcon,
	},
	{
		text: "Analytics shows usage, estimated cost and answer ratings.",
		icon: BarChart3Icon,
	},
	{
		text: "Connect OpenAI, Anthropic or any OpenAI-compatible provider and choose its models.",
		icon: PlugIcon,
	},
	{
		text: "A readiness checklist leads admins through setting up a new organisation.",
		icon: ListChecksIcon,
	},
	{
		text: "Pin, search and branch chats.",
		icon: GitBranchIcon,
	},
	{
		text: "Two-factor authentication and passkeys protect accounts.",
		icon: FingerprintIcon,
	},
	{
		text: "The app is in English and German.",
		icon: LanguagesIcon,
	},
	{
		text: "Export your personal data as a zip archive at any time.",
		icon: BookOpenCheckIcon,
	},
];

export const primaryCta = {
	label: "Contact the OrcAI team",
	href: `mailto:${siteConfig.contactEmail}`,
	icon: MailIcon,
} as const;

export const secondaryCta = {
	label: "Read the docs",
	href: "/docs",
} as const;
