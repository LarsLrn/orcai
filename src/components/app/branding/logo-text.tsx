import { cn } from "@/lib/utils";
import textColorLogo from "@/static/branding/text_color.svg";
import textWhiteLogo from "@/static/branding/text_white.svg";

const LogoText = ({ className }: { className?: string }) => {
	return (
		<div className={cn("flex w-full items-center justify-center", className)}>
			<img
				src={textColorLogo}
				alt="OrcAI logo"
				width={150}
				height={40}
				className="h-14 w-auto dark:hidden"
			/>
			<img
				src={textWhiteLogo}
				alt="OrcAI logo"
				width={150}
				height={40}
				className="hidden h-14 w-auto dark:block"
			/>
		</div>
	);
};

export { LogoText };
