import { MoonIcon, SunIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "@/components/app/theme-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { META_THEME_COLORS, useMetaColor } from "@/hooks/use-meta-color";
import { cn } from "@/lib/utils";

const ThemeSwitcher = ({ className }: { className?: string }) => {
	const [mounted, setMounted] = useState(false);

	const { setTheme, theme } = useTheme();
	const { setMetaColor } = useMetaColor();
	const [isDark, setIsDark] = useState(theme === "dark");

	useEffect(() => {
		setMounted(true);
	}, []);

	const toggleTheme = useCallback(() => {
		const newTheme = theme === "dark" ? "light" : "dark";
		setTheme(newTheme);
		setMetaColor(
			newTheme === "dark" ? META_THEME_COLORS.dark : META_THEME_COLORS.light,
		);
		setIsDark(newTheme === "dark");
	}, [
		theme,
		setTheme,
		setMetaColor,
	]);

	if (!mounted) {
		return <Skeleton className={cn("size-8", className)} />;
	}

	return (
		<Button
			variant="ghost"
			size="icon"
			className={cn("group/toggle overflow-hidden", className)}
			onClick={toggleTheme}
		>
			<AnimatePresence initial={false} mode="wait">
				{isDark ? (
					<motion.div
						key="sun"
						initial={{
							y: -20,
							opacity: 0,
						}}
						animate={{
							y: 0,
							opacity: 1,
						}}
						exit={{
							y: 20,
							opacity: 0,
						}}
						transition={{
							duration: 0.3,
						}}
					>
						<SunIcon className="block" />
						<span className="sr-only">Toggle dark mode</span>
					</motion.div>
				) : (
					<motion.div
						key="moon"
						initial={{
							y: -20,
							opacity: 0,
						}}
						animate={{
							y: 0,
							opacity: 1,
						}}
						exit={{
							y: 20,
							opacity: 0,
						}}
						transition={{
							duration: 0.3,
						}}
					>
						<MoonIcon className="block" />
						<span className="sr-only">Toggle light mode</span>
					</motion.div>
				)}
			</AnimatePresence>
			<span className="sr-only">Toggle theme</span>
		</Button>
	);
};

export { ThemeSwitcher };
