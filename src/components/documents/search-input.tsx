import { useTransition } from "react";
import { useDebounceCallback } from "usehooks-ts";
import { Input } from "@/components/ui/input";
/* import { useBucketSearchParams } from "@/lib/nuqs/search-params.bucket"; */
import { cn } from "@/lib/utils";

const SearchInput = ({
	type,
	placeholder,
	className,
	...props
}: React.ComponentProps<"input">) => {
	const [, _startTransition] = useTransition();
	/* const [{ search, page }, setQuery] = useBucketSearchParams(startTransition); */

	const handleSearch = useDebounceCallback((_search: string) => {
		/* setQuery({ search });
    if (page !== 1) {
      setQuery({ page: 1 });
    } */
	}, 500);

	return (
		<Input
			type={type}
			/* defaultValue={search} */
			onChange={(e) => handleSearch(e.target.value)}
			placeholder={placeholder || "Search..."}
			className={cn("h-8 max-w-[300px]", className)}
			{...props}
		/>
	);
};

export { SearchInput };
