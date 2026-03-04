import { cva, type VariantProps } from "class-variance-authority";
import { CircleHelpIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = cva(
	"flex flex-col items-center gap-4 rounded-sm border p-4 text-center",
	{
		variants: {
			variant: {
				default: "",
				muted: "text-muted-foreground",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

const SimplePlaceholder = ({
	children,
	className,
	variant,
	Icon = CircleHelpIcon,
	iconSize = 30,
	...props
}: {
	children: React.ReactNode;
	className?: string;
	Icon?: LucideIcon;
	iconSize?: number;
} & VariantProps<typeof variants> &
	React.ComponentProps<"div">): React.ReactNode => {
	return (
		<div
			{...props}
			className={cn(
				variants({
					variant,
					className,
				}),
			)}
		>
			<Icon size={iconSize} />
			<span>{children}</span>
		</div>
	);
};

export { SimplePlaceholder };
