import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LogoText } from "@/components/app/branding/logo-text";
import { ThemeSwitcher } from "@/components/app/theme-switcher";
import { AuroraBackground } from "@/components/ui/aceternity/aurora-background";

export const Route = createFileRoute("/_pathlessLayout")({
	component: PathlessLayoutComponent,
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

			<div className="my-4 flex w-full justify-around p-2">
				OrcAI is a fork of{" "}
				<a href="https://github.com/SokratesT/sokratest">Sokratest</a>.
			</div>
		</main>
	);
}
