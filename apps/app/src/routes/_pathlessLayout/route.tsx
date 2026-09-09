import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LogoText } from "@/components/app/branding/logo-text";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { ThemeSwitcher } from "@/components/app/theme-switcher";
import { AuroraBackground } from "@/components/ui/aceternity/aurora-background";

export const Route = createFileRoute("/_pathlessLayout")({
	component: PathlessLayoutComponent,
	pendingComponent: LoadingPage,
});

function PathlessLayoutComponent() {
	return (
		<main className="flex min-h-screen flex-col">
			<AuroraBackground className="fixed inset-0 -z-10 h-full w-full" />

			<ThemeSwitcher className="fixed top-4 right-4 z-20 text-foreground" />

			<div className="flex flex-col items-center justify-center gap-4 px-2 py-8">
				<LogoText className="h-20" />

				<Outlet />
			</div>

			<footer className="mx-auto my-4 w-full max-w-xl px-2 py-2 text-center text-muted-foreground text-xs">
				OrcAI is a fork of{" "}
				<a
					href="https://github.com/SokratesT/sokratest"
					target="_blank"
					rel="noopener noreferrer"
					className="rounded-sm text-primary underline-offset-4 outline-none transition-[color,box-shadow] hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
				>
					SokratesT
				</a>
				.
			</footer>
		</main>
	);
}
