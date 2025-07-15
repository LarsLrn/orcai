import { CircleHelpIcon, type LucideIcon } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const Placeholder = ({
	children,
	className,
	Icon = CircleHelpIcon,
	size = 50,
}: {
	children: React.ReactNode;
	className?: string;
	Icon?: LucideIcon;
	size?: number;
}): React.ReactNode => {
	return (
		<Card className={cn(className, "flex h-full items-center justify-center")}>
			<CardHeader className="w-full">
				<CardTitle className="text-muted-foreground">
					<div className="flex flex-col items-center gap-4 text-center">
						<Icon size={size} />
						{children}
					</div>
				</CardTitle>
			</CardHeader>
		</Card>
	);
};

export { Placeholder };
