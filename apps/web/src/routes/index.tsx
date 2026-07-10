import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import {
	ArrowRightIcon,
	CheckCircle2Icon,
	CircleDotIcon,
	Code2Icon,
} from "lucide-react";
import {
	audiences,
	constraints,
	governance,
	pillars,
	primaryCta,
	secondaryCta,
	stack,
	useCases,
	workflow,
} from "@/components/landing/content";
import { ConsoleVisual } from "@/components/landing/product-visuals";
import {
	ActionLink,
	BodyCopy,
	Eyebrow,
	LandingSection,
	SectionHeading,
	Surface,
} from "@/components/landing/ui";
import { baseOptions } from "@/lib/layout.shared";
import { siteConfig } from "@/lib/site-config";

export const Route = createFileRoute("/")({
	component: Home,
});

function Home() {
	const PrimaryIcon = primaryCta.icon;

	return (
		<HomeLayout {...baseOptions()}>
			<main className="landing-page bg-landing-canvas text-landing-foreground">
				<LandingSection className="py-6">
					<Surface className="bg-landing-surface p-4">
						<div className="flex flex-wrap items-center justify-between gap-3 border-landing-border-subtle border-b px-2 pb-4 text-sm">
							<Link
								to="/docs/$"
								className="text-landing-muted transition-colors hover:text-landing-foreground"
							>
								OrcAI documentation
							</Link>
							<div className="flex flex-wrap gap-2">
								<a
									href={siteConfig.repository.url}
									className="rounded-full bg-landing-accent px-3 py-1 font-medium text-landing-accent-foreground transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-landing-accent-muted focus-visible:outline-offset-2"
								>
									Open source
								</a>
								<Link
									to="/docs/$"
									params={{
										_splat: "self-hosting",
									}}
									className="rounded-full border border-landing-border px-3 py-1 transition-colors hover:bg-landing-surface-raised focus-visible:outline-2 focus-visible:outline-landing-accent-muted focus-visible:outline-offset-2"
								>
									Self-hostable
								</Link>
							</div>
						</div>

						<div className="grid gap-10 px-1 py-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-6 lg:py-16">
							<div>
								<Eyebrow className="mb-4">Configure. Ground. Govern.</Eyebrow>
								<h1 className="max-w-4xl text-balance font-semibold text-5xl leading-none sm:text-7xl">
									Knowledge assistants you can operate on your own terms.
								</h1>
								<BodyCopy className="mt-6 max-w-2xl text-lg leading-8">
									OrcAI helps individuals, specialist teams, educators, and
									research groups build AI assistants around curated knowledge
									bases. Upload material, shape assistant behaviour, control
									access, and run the stack without depending on external SaaS
									services beyond an inference provider.
								</BodyCopy>
								<div className="mt-8 flex flex-wrap gap-3">
									<ActionLink href={primaryCta.href} variant="primary">
										<PrimaryIcon className="size-4" />
										{primaryCta.label}
									</ActionLink>
									<ActionLink href={secondaryCta.href}>
										{secondaryCta.label}
										<ArrowRightIcon className="size-4" />
									</ActionLink>
									<ActionLink href={siteConfig.repository.url}>
										<Code2Icon className="size-4" /> GitHub
									</ActionLink>
								</div>
							</div>
							<ConsoleVisual />
						</div>
					</Surface>
				</LandingSection>

				<LandingSection>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{pillars.map((pillar) => (
							<Surface key={pillar.title} className="p-6">
								<pillar.icon className="mb-10 size-7 text-landing-accent-muted" />
								<h2 className="text-2xl">{pillar.title}</h2>
								<BodyCopy className="mt-3">{pillar.description}</BodyCopy>
							</Surface>
						))}
					</div>
				</LandingSection>

				<LandingSection className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
					<Surface className="p-6">
						<SectionHeading eyebrow="Working model">
							From source material to governed assistant.
						</SectionHeading>
						<BodyCopy className="mt-4">
							Generic chat tools make people improvise context, policy, and
							quality checks. OrcAI turns those concerns into explicit workspace
							resources: content, repository blocks, behaviour blocks, bots,
							access settings, providers, and quotas.
						</BodyCopy>
					</Surface>
					<Surface className="divide-y divide-landing-border-subtle p-3">
						{workflow.map((item, index) => (
							<div
								key={item}
								className="grid gap-4 p-4 sm:grid-cols-[2.5rem_1fr] sm:items-center"
							>
								<div className="flex size-9 items-center justify-center rounded-full bg-landing-accent font-mono text-landing-accent-foreground text-sm">
									{index + 1}
								</div>
								<p className="text-lg">{item}</p>
							</div>
						))}
					</Surface>
				</LandingSection>

				<LandingSection>
					<div className="grid gap-6 lg:grid-cols-2 lg:items-end">
						<SectionHeading eyebrow="Governance" className="max-w-2xl">
							Control is part of the application, not an afterthought.
						</SectionHeading>
						<BodyCopy>
							OrcAI is built for settings where the knowledge base, access
							model, model configuration, and operating environment matter. The
							stack is open source and can be hosted with infrastructure you
							control.
						</BodyCopy>
					</div>
					<div className="mt-6 grid gap-4 md:grid-cols-3">
						{governance.map((item) => (
							<Surface key={item.title} className="p-6">
								<item.icon className="mb-10 size-6 text-landing-accent-muted" />
								<h3 className="font-semibold text-xl">{item.title}</h3>
								<BodyCopy className="mt-3">{item.description}</BodyCopy>
							</Surface>
						))}
					</div>
				</LandingSection>

				<LandingSection className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
					<Surface className="bg-landing-surface p-6">
						<SectionHeading eyebrow="Self-hosting">
							A full stack you can inspect.
						</SectionHeading>
						<BodyCopy className="mt-4">
							The application runs with its own app process, background workers,
							relational data, cache, object storage, vector search, and
							authorization service. The required external boundary is an
							OpenAI-compatible inference endpoint for embeddings and model
							calls.
						</BodyCopy>
						<ActionLink
							href="/docs/self-hosting"
							variant="primary"
							className="mt-6 px-4 py-2"
						>
							Self-hosting docs <ArrowRightIcon className="size-4" />
						</ActionLink>
					</Surface>
					<div className="grid gap-3 sm:grid-cols-2">
						{stack.map((item) => (
							<Surface key={item} className="flex items-center gap-3 p-4">
								<CheckCircle2Icon className="size-5 shrink-0 text-landing-accent-muted" />
								<span>{item}</span>
							</Surface>
						))}
					</div>
				</LandingSection>

				<LandingSection>
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{audiences.map((audience) => (
							<Surface key={audience.label} className="p-6">
								<audience.icon className="mb-10 size-6 text-landing-accent-muted" />
								<h3 className="font-semibold">{audience.label}</h3>
								<BodyCopy className="mt-3">{audience.value}</BodyCopy>
							</Surface>
						))}
					</div>
				</LandingSection>

				<LandingSection>
					<Surface className="p-6">
						<div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
							<SectionHeading eyebrow="Use cases">
								Useful wherever knowledge needs context and boundaries.
							</SectionHeading>
							<div className="grid gap-4">
								{useCases.map((useCase) => (
									<div key={useCase} className="flex items-start gap-3">
										<CircleDotIcon className="mt-1 size-4 shrink-0 text-landing-accent-muted" />
										<BodyCopy>{useCase}</BodyCopy>
									</div>
								))}
							</div>
						</div>
					</Surface>
				</LandingSection>

				<LandingSection className="pt-6 pb-20">
					<Surface className="bg-landing-surface p-6">
						<SectionHeading>Context and constraints</SectionHeading>
						<div className="mt-6 grid gap-3 md:grid-cols-2">
							{constraints.map((constraint) => (
								<div
									key={constraint}
									className="flex items-start gap-3 rounded-lg bg-landing-surface-raised p-4"
								>
									<CircleDotIcon className="mt-1 size-4 shrink-0 text-landing-accent-muted" />
									<BodyCopy>{constraint}</BodyCopy>
								</div>
							))}
						</div>
					</Surface>
				</LandingSection>
			</main>
		</HomeLayout>
	);
}
