import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SkeletonsArray = ({
	count = 3,
	className,
	...props
}: {
	count?: number;
} & React.ComponentProps<"div">) => {
	return Array.from(
		{
			length: count,
		},
		(_, index) => (
			<Skeleton
				key={index}
				className={cn(className, "h-12 w-full")}
				{...props}
			/>
		),
	);
};

export { SkeletonsArray };
