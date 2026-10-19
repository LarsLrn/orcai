import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { m } from "@/paraglide/messages";

type DataTableSearchProps = {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	debounceMs?: number;
};

const DataTableSearch = ({
	value,
	onChange,
	placeholder = m.common_search_placeholder(),
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
		<div className="relative w-full sm:w-auto sm:min-w-40 sm:max-w-xs sm:flex-1">
			<SearchIcon
				aria-hidden="true"
				className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				aria-label={placeholder}
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
					<XIcon aria-hidden="true" />
					<span className="sr-only">{m.data_table_search_clear_label()}</span>
				</Button>
			) : null}
		</div>
	);
};

export { DataTableSearch };
