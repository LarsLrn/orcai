import { Button } from "@/components/ui/button";
import { describeError } from "@/lib/errors/describe-error";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** A failed read's message and a Retry that shows the reload. */
const LoadError = ({
	query,
	className,
}: {
	query: {
		error: unknown;
		isRefetching: boolean;
		refetch: () => unknown;
	};
	className?: string;
}) => (
	<div
		role="alert"
		className={cn(
			"text-muted-foreground flex flex-col items-center py-8 text-center text-sm",
			className,
		)}
	>
		{describeError(query.error)}
		<Button
			variant="outline"
			size="sm"
			className="mt-3"
			loading={query.isRefetching}
			onClick={() => void query.refetch()}
		>
			{m.common_retry_button()}
		</Button>
	</div>
);

export { LoadError };
