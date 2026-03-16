import { cn } from "@/lib/utils";

/**
 * Generic hero banner with a subtle gradient overlay.
 * Compose with HeroContent (main copy) and optionally HeroMedia (side element).
 *
 * Example:
 *   <Hero>
 *     <HeroContent>...</HeroContent>
 *     <HeroMedia>...</HeroMedia>   {/* optional *\/}
 *   </Hero>
 */
const Hero = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			data-slot="hero"
			className={cn(
				"relative overflow-hidden rounded-2xl border bg-card shadow-xl ring-1 ring-foreground/10",
				className,
			)}
			{...props}
		/>
	);
};

const HeroGradient = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			data-slot="hero-gradient"
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute inset-0 bg-linear-to-br from-primary/20 via-accent/20 to-transparent",
				className,
			)}
			{...props}
		/>
	);
};

const HeroInner = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			data-slot="hero-inner"
			className={cn(
				"relative flex flex-col gap-10 p-8 md:p-10 lg:flex-row lg:items-start lg:justify-between",
				className,
			)}
			{...props}
		/>
	);
};

const HeroContent = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			data-slot="hero-content"
			className={cn("flex flex-col gap-6 text-card-foreground", className)}
			{...props}
		/>
	);
};

const HeroMedia = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			data-slot="hero-media"
			className={cn("w-full lg:max-w-xs", className)}
			{...props}
		/>
	);
};

/**
 * Alternative to HeroGradient. Renders a static SVG wave anchored to the
 * bottom of the hero. Use as a sibling of HeroInner inside Hero.
 *
 * The wave path uses the current card foreground colour at very low opacity so
 * it adapts automatically when the theme changes.
 */
const HeroWave = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			data-slot="hero-wave"
			aria-hidden="true"
			className={cn("pointer-events-none absolute -inset-1", className)}
			{...props}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 1440 320"
				preserveAspectRatio="none"
				aria-hidden="true"
				className="absolute bottom-0 left-0 h-[55%] w-full"
			>
				{/* back wave — lightest */}
				<path
					d="M0,224 C240,288 480,160 720,192 C960,224 1200,288 1440,256 L1440,320 L0,320 Z"
					className="fill-primary/5"
				/>
				{/* mid wave */}
				<path
					d="M0,256 C200,224 400,288 600,256 C800,224 1000,272 1200,248 C1300,236 1380,252 1440,264 L1440,320 L0,320 Z"
					className="fill-primary/10"
				/>
				{/* front wave — most visible */}
				<path
					d="M0,288 C180,260 360,304 540,288 C720,272 900,300 1080,284 C1260,268 1380,292 1440,296 L1440,320 L0,320 Z"
					className="fill-primary/15"
				/>
			</svg>
		</div>
	);
};

export { Hero, HeroContent, HeroGradient, HeroInner, HeroMedia, HeroWave };
