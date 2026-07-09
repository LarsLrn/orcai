import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DataTableSearchProps = {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	debounceMs?: number;
};

const DataTableSearch = ({
	value,
	onChange,
	placeholder = "Search...",
	debounceMs = 250,
}: DataTableSearchProps) => {
	const [draft, setDraft] = useState(value);

	useEffect(
		() => setDraft(value),
		[
			value,
		],
	);
	useEffect(() => {
		if (draft === value) return;
		const timeout = window.setTimeout(() => onChange(draft), debounceMs);
		return () => window.clearTimeout(timeout);
	}, [
		debounceMs,
		draft,
		onChange,
		value,
	]);

	return (
		<div className="relative w-full sm:max-w-xs">
			<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				placeholder={placeholder}
				className="h-8 pr-9 pl-9"
			/>
			{draft ? (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="absolute top-1/2 right-1 -translate-y-1/2"
					onClick={() => {
						setDraft("");
						onChange("");
					}}
				>
					<XIcon />
					<span className="sr-only">Clear search</span>
				</Button>
			) : null}
		</div>
	);
};

export { DataTableSearch };
