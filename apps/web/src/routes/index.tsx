import { createFileRoute } from "@tanstack/react-router";
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
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/")({
	component: Home,
});

function Home() {
	const PrimaryIcon = primaryCta.icon;

	return (
		<HomeLayout {...baseOptions()}>
			<main className="bg-[#eef1f0] text-[#101615] dark:bg-[#080d0c] dark:text-[#f3f7f5]">
				<section className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
					<div className="rounded-lg border border-[#c7d0cd] bg-[#f8faf9] p-4 dark:border-[#1e2b28] dark:bg-[#0d1513]">
						<div className="flex flex-wrap items-center justify-between gap-3 border-[#dce2df] border-b px-2 pb-4 text-sm dark:border-[#1e2b28]">
							<a href="/docs" className="text-[#53615e] dark:text-[#b8c4c0]">
								OrcAI documentation
							</a>
							<div className="flex flex-wrap gap-2">
								<span className="rounded-full bg-[#d9f99d] px-3 py-1 font-medium text-[#263400]">
									Open source
								</span>
								<span className="rounded-full border border-[#c7d0cd] px-3 py-1 dark:border-[#2e3b38]">
									Self-hostable
								</span>
							</div>
						</div>

						<div className="grid gap-8 px-1 py-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-6 lg:py-16">
							<div>
								<p className="mb-4 font-mono text-[#4f6f2a] text-sm uppercase dark:text-[#d9f99d]">
									Configure. Ground. Govern.
								</p>
								<h1 className="max-w-4xl text-balance font-semibold text-5xl leading-none sm:text-7xl">
									Knowledge assistants you can operate on your own terms.
								</h1>
								<p className="mt-6 max-w-2xl text-[#53615e] text-lg leading-8 dark:text-[#b8c4c0]">
									OrcAI helps individuals, specialist teams, educators, and
									research groups build AI assistants around curated knowledge
									bases. Upload material, shape assistant behaviour, control
									access, and run the stack without depending on external SaaS
									services beyond an inference provider.
								</p>
								<div className="mt-8 flex flex-wrap gap-3">
									<a
										href={primaryCta.href}
										className="inline-flex items-center gap-2 rounded-lg bg-[#101615] px-5 py-3 font-medium text-white dark:bg-[#d9f99d] dark:text-[#172000]"
									>
										<PrimaryIcon className="size-4" />
										{primaryCta.label}
									</a>
									<a
										href={secondaryCta.href}
										className="inline-flex items-center gap-2 rounded-lg border border-[#c7d0cd] px-5 py-3 font-medium dark:border-[#2e3b38]"
									>
										{secondaryCta.label}
										<ArrowRightIcon className="size-4" />
									</a>
									<a
										href="https://github.com/SokratesT/orcai"
										className="inline-flex items-center gap-2 rounded-lg border border-[#c7d0cd] px-5 py-3 font-medium dark:border-[#2e3b38]"
									>
										<Code2Icon className="size-4" />
										GitHub
									</a>
								</div>
							</div>
							<ConsoleVisual />
						</div>
					</div>
				</section>

				<section className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
					<div className="grid gap-4 md:grid-cols-3">
						{pillars.map((pillar) => (
							<div
								key={pillar.title}
								className="rounded-lg bg-[#101615] p-6 text-white dark:bg-[#111d1a]"
							>
								<pillar.icon className="mb-10 size-7 text-[#d9f99d]" />
								<h2 className="text-2xl">{pillar.title}</h2>
								<p className="mt-3 text-[#c4cfcb] leading-7">
									{pillar.description}
								</p>
							</div>
						))}
					</div>
				</section>

				<section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
					<div className="rounded-lg border border-[#c7d0cd] bg-white p-6 dark:border-[#1e2b28] dark:bg-[#0d1513]">
						<p className="font-mono text-[#4f6f2a] text-sm uppercase dark:text-[#d9f99d]">
							Working model
						</p>
						<h2 className="mt-4 text-3xl">
							From source material to governed assistant.
						</h2>
						<p className="mt-4 text-[#53615e] leading-7 dark:text-[#b8c4c0]">
							Generic chat tools make people improvise context, policy, and
							quality checks. OrcAI turns those concerns into explicit workspace
							resources: content, repository blocks, behaviour blocks, bots,
							access settings, providers, and quotas.
						</p>
					</div>
					<div className="rounded-lg border border-[#c7d0cd] bg-white p-3 dark:border-[#1e2b28] dark:bg-[#0d1513]">
						{workflow.map((item, index) => (
							<div
								key={item}
								className="grid gap-4 rounded-lg p-4 sm:grid-cols-[2.5rem_1fr]"
							>
								<div className="flex size-9 items-center justify-center rounded-full bg-[#d9f99d] font-mono text-[#263400] text-sm">
									{index + 1}
								</div>
								<p className="text-lg">{item}</p>
							</div>
						))}
					</div>
				</section>

				<section className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
					<div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
						<div>
							<p className="font-mono text-[#4f6f2a] text-sm uppercase dark:text-[#d9f99d]">
								Governance
							</p>
							<h2 className="mt-4 max-w-2xl text-3xl">
								Control is part of the application, not an afterthought.
							</h2>
						</div>
						<p className="text-[#53615e] leading-7 dark:text-[#b8c4c0]">
							OrcAI is built for settings where the knowledge base, access
							model, model configuration, and operating environment matter. The
							stack is open source and can be hosted with infrastructure you
							control.
						</p>
					</div>
					<div className="mt-6 grid gap-4 md:grid-cols-3">
						{governance.map((item) => (
							<div
								key={item.title}
								className="rounded-lg border border-[#c7d0cd] bg-white p-6 dark:border-[#1e2b28] dark:bg-[#0d1513]"
							>
								<item.icon className="mb-10 size-6 text-[#4f6f2a] dark:text-[#d9f99d]" />
								<h3 className="font-semibold text-xl">{item.title}</h3>
								<p className="mt-3 text-[#53615e] leading-7 dark:text-[#b8c4c0]">
									{item.description}
								</p>
							</div>
						))}
					</div>
				</section>

				<section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
					<div className="rounded-lg border border-[#c7d0cd] bg-[#f8faf9] p-6 dark:border-[#1e2b28] dark:bg-[#0d1513]">
						<p className="font-mono text-[#4f6f2a] text-sm uppercase dark:text-[#d9f99d]">
							Self-hosting
						</p>
						<h2 className="mt-4 text-3xl">A full stack you can inspect.</h2>
						<p className="mt-4 text-[#53615e] leading-7 dark:text-[#b8c4c0]">
							The application runs with its own app process, background workers,
							relational data, cache, object storage, vector search, and
							authorization service. The required external boundary is an
							OpenAI-compatible inference endpoint for embeddings and model
							calls.
						</p>
						<a
							href="/docs/self-hosting"
							className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#101615] px-4 py-2 font-medium text-white dark:bg-[#d9f99d] dark:text-[#172000]"
						>
							Self-hosting docs
							<ArrowRightIcon className="size-4" />
						</a>
					</div>
					<div className="grid gap-3 sm:grid-cols-2">
						{stack.map((item) => (
							<div
								key={item}
								className="flex items-center gap-3 rounded-lg border border-[#c7d0cd] bg-white p-4 dark:border-[#1e2b28] dark:bg-[#0d1513]"
							>
								<CheckCircle2Icon className="size-5 shrink-0 text-[#4f6f2a] dark:text-[#d9f99d]" />
								<span>{item}</span>
							</div>
						))}
					</div>
				</section>

				<section className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{audiences.map((audience) => (
							<div
								key={audience.label}
								className="rounded-lg border border-[#c7d0cd] bg-white p-6 dark:border-[#1e2b28] dark:bg-[#0d1513]"
							>
								<audience.icon className="mb-10 size-6 text-[#4f6f2a] dark:text-[#d9f99d]" />
								<h3 className="font-semibold">{audience.label}</h3>
								<p className="mt-3 text-[#53615e] leading-7 dark:text-[#b8c4c0]">
									{audience.value}
								</p>
							</div>
						))}
					</div>
				</section>

				<section className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
					<div className="rounded-lg border border-[#c7d0cd] bg-white p-6 dark:border-[#1e2b28] dark:bg-[#0d1513]">
						<div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
							<div>
								<p className="font-mono text-[#4f6f2a] text-sm uppercase dark:text-[#d9f99d]">
									Use cases
								</p>
								<h2 className="mt-4 text-3xl">
									Useful wherever knowledge needs context and boundaries.
								</h2>
							</div>
							<div className="grid gap-3">
								{useCases.map((useCase) => (
									<div key={useCase} className="flex items-start gap-3">
										<CircleDotIcon className="mt-1 size-4 shrink-0 text-[#4f6f2a] dark:text-[#d9f99d]" />
										<p className="text-[#53615e] leading-7 dark:text-[#b8c4c0]">
											{useCase}
										</p>
									</div>
								))}
							</div>
						</div>
					</div>
				</section>

				<section className="mx-auto max-w-7xl px-4 pt-6 pb-20 sm:px-8">
					<div className="rounded-lg border border-[#c7d0cd] bg-[#f8faf9] p-6 dark:border-[#1e2b28] dark:bg-[#0d1513]">
						<h2 className="text-3xl">Context and constraints</h2>
						<div className="mt-6 grid gap-3 md:grid-cols-2">
							{constraints.map((constraint) => (
								<div
									key={constraint}
									className="flex items-start gap-3 rounded-lg bg-white p-4 dark:bg-[#101917]"
								>
									<CircleDotIcon className="mt-1 size-4 shrink-0 text-[#4f6f2a] dark:text-[#d9f99d]" />
									<span className="text-[#53615e] leading-7 dark:text-[#b8c4c0]">
										{constraint}
									</span>
								</div>
							))}
						</div>
					</div>
				</section>
			</main>
		</HomeLayout>
	);
}
