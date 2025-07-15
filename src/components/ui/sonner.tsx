import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

const Toaster = ({
	mobilePosition = "bottom-right",
	...props
}: { mobilePosition?: ToasterProps["position"] } & ToasterProps) => {
	const { theme = "system" } = useTheme();
	const isMobile = useIsMobile();

	return (
		<Sonner
			theme={theme as ToasterProps["theme"]}
			className="toaster group"
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
				} as React.CSSProperties
			}
			position={isMobile ? mobilePosition : props.position}
			{...props}
		/>
	);
};

export { Toaster };
