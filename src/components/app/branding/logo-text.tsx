import { cn } from "@/lib/utils";

const LogoText = ({ className }: { className?: string }) => {
	return (
		<div className={cn("flex w-full items-center justify-center", className)}>
			<img
				src="/logo/text_color.svg"
				alt="OrcAI logo"
				width={150}
				height={40}
				className="h-14 w-auto dark:hidden"
			/>
			<img
				src="/logo/text_white.svg"
				alt="OrcAI logo"
				width={150}
				height={40}
				className="hidden h-14 w-auto dark:block"
			/>
		</div>
	);
};

export { LogoText };
