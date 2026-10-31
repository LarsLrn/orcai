import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useState } from "react";
import { SearchField } from "@/components/ui/composed/search-field";
import { dataTableQuerySchema, withQuery } from "./data-table-search-params";

type DataTableSearchProps = {
	placeholder?: string;
	debounceMs?: number;
	className?: string;
};

type Emission = {
	id: string;
	query: string;
};

const emissionId = () => Math.random().toString(36).slice(2);

/**
 * Edits the `query` search param. The input owns what the user types and
 * navigates with the trimmed query after a pause, tagging the history entry.
 * A location carrying a pending tag settles it and any earlier, superseded
 * ones; any other location (cleared filters, back and forward) replaces the
 * draft and drops the pending pause.
 */
const DataTableSearch = ({
	placeholder,
	debounceMs = 250,
	className = "min-w-40 flex-1 sm:max-w-xs",
}: DataTableSearchProps) => {
	const navigate = useNavigate();
	const location = useLocation({
		select: ({ search, state }) => ({
			key: state.__TSR_key,
			emission: state.dataTableSearch,
			query:
				"query" in search && typeof search.query === "string"
					? search.query
					: "",
		}),
	});
	const [draft, setDraft] = useState(location.query);
	const [composing, setComposing] = useState(false);
	const [synced, setSynced] = useState({
		key: location.key,
		query: location.query,
		pending: [] as Emission[],
	});
	if (location.key !== synced.key) {
		const echo = synced.pending.findIndex(
			(emission) => emission.id === location.emission,
		);
		setSynced({
			key: location.key,
			query: location.query,
			pending: echo === -1 ? [] : synced.pending.slice(echo + 1),
		});
		if (echo === -1) setDraft(location.query);
	}

	const emit = (query: string) => {
		const id = emissionId();
		setSynced((current) => ({
			...current,
			pending: [
				...current.pending,
				{
					id,
					query,
				},
			],
		}));
		void navigate({
			to: ".",
			search: (prev) => withQuery(prev, query),
			state: (prev) => ({
				...prev,
				dataTableSearch: id,
			}),
			replace: true,
		});
	};
	const emitAfterPause = useEffectEvent(emit);
	const query = draft.trim();
	const latest = synced.pending.at(-1)?.query ?? synced.query;
	useEffect(() => {
		if (composing || query === latest) return;
		const timeout = window.setTimeout(() => emitAfterPause(query), debounceMs);
		return () => window.clearTimeout(timeout);
	}, [
		composing,
		debounceMs,
		latest,
		query,
	]);

	return (
		<SearchField
			value={draft}
			onValueChange={setDraft}
			onClear={() => {
				setDraft("");
				if (latest) emit("");
			}}
			onCompositionStart={() => setComposing(true)}
			onCompositionEnd={() => setComposing(false)}
			placeholder={placeholder}
			maxLength={dataTableQuerySchema.maxLength ?? undefined}
			className={className}
		/>
	);
};

export { DataTableSearch };
