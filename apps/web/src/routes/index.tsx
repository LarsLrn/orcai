import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { ArrowRightIcon, Code2Icon } from "lucide-react";
import {
	features,
	heroScreenshot,
	moreFeatures,
	primaryCta,
	secondaryCta,
} from "@/components/landing/content";
import { ProductScreenshot } from "@/components/landing/product-visuals";
import {
	ActionLink,
	BodyCopy,
	LandingSection,
	SectionHeading,
	Surface,
} from "@/components/landing/ui";
import { cn } from "@/lib/cn";
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
									className="rounded-full bg-landing-accent-tint px-3 py-1 font-medium text-landing-accent-muted text-xs transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-landing-accent focus-visible:outline-offset-2"
								>
									Open source
								</a>
								<Link
									to="/docs/$"
									params={{
										_splat: "self-hosting",
									}}
									className="rounded-full border border-landing-border px-3 py-1 text-xs transition-colors hover:bg-landing-surface-hover focus-visible:outline-2 focus-visible:outline-landing-accent focus-visible:outline-offset-2"
								>
									Self-hostable
								</Link>
							</div>
						</div>

						<div className="grid gap-10 px-1 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-6 lg:py-14">
							<div>
								<h1 className="max-w-4xl text-balance font-semibold text-4xl leading-none tracking-tight sm:text-6xl">
									AI that answers from your own material.
								</h1>
								<BodyCopy className="mt-6 max-w-2xl text-lg leading-8">
									Turn course or team material into bots that cite their
									sources, and share them with your organisation.
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
								<p className="mt-6 text-landing-muted text-sm">
									Made for teaching and learning, research groups and specialist
									teams.
								</p>
							</div>
							<ProductScreenshot screenshot={heroScreenshot} priority />
						</div>
					</Surface>
				</LandingSection>

				{features.map((feature, index) => (
					<LandingSection
						key={feature.eyebrow}
						className={cn(
							"grid gap-8 lg:items-center",
							index % 2 === 0
								? "lg:grid-cols-[0.75fr_1.25fr]"
								: "lg:grid-cols-[1.25fr_0.75fr]",
						)}
					>
						<div className={cn(index % 2 === 1 && "lg:order-last")}>
							<SectionHeading eyebrow={feature.eyebrow}>
								{feature.title}
							</SectionHeading>
							<BodyCopy className="mt-4">{feature.description}</BodyCopy>
						</div>
						<ProductScreenshot screenshot={feature.screenshot} />
					</LandingSection>
				))}

				<LandingSection>
					<Surface className="p-6">
						<SectionHeading>More in OrcAI</SectionHeading>
						<ul className="mt-6 grid gap-x-8 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
							{moreFeatures.map((item) => (
								<li key={item.text} className="flex items-start gap-3">
									<item.icon className="mt-0.5 size-5 shrink-0 text-landing-muted" />
									<BodyCopy>{item.text}</BodyCopy>
								</li>
							))}
						</ul>
					</Surface>
				</LandingSection>

				<LandingSection className="grid gap-6 pb-20 lg:grid-cols-[1.05fr_0.95fr]">
					<Surface className="bg-landing-surface p-6">
						<SectionHeading eyebrow="Self-hosting">
							Run OrcAI on your own servers.
						</SectionHeading>
						<BodyCopy className="mt-4">
							OrcAI is open source under the AGPL-3.0 and runs with Docker
							Compose. Besides the app and its background workers, it uses
							PostgreSQL, Valkey, S3-compatible storage, Qdrant and SpiceDB.
							Language models come from the providers each organisation
							connects, and embeddings from an OpenAI-compatible endpoint.
						</BodyCopy>
						<div className="mt-6 flex flex-wrap gap-3">
							<ActionLink href="/docs/self-hosting" variant="primary">
								Self-hosting docs <ArrowRightIcon className="size-4" />
							</ActionLink>
							<ActionLink href={siteConfig.repository.url}>
								<Code2Icon className="size-4" /> Source code
							</ActionLink>
						</div>
					</Surface>
					<Surface className="p-6">
						<SectionHeading eyebrow="Origin">
							Built for teaching at Rhine-Waal University.
						</SectionHeading>
						<BodyCopy className="mt-4">
							OrcAI grew out of the Sokratesᵗ project and KI:edu.nrw at
							Rhine-Waal University. It is in beta and changes often.
						</BodyCopy>
						<ActionLink href={primaryCta.href} className="mt-6">
							<PrimaryIcon className="size-4" />
							{primaryCta.label}
						</ActionLink>
					</Surface>
				</LandingSection>
			</main>
		</HomeLayout>
	);
}
