import {
	WEB_SEARCH_MAX_ALLOWED_DOMAINS,
	webSearchDomainSchema,
} from "@orcai/schema";
import { PlusIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { m } from "@/paraglide/messages";

/** `https://Docs.Example.org/path` reads as `docs.example.org`. */
const toDomain = (text: string) =>
	text
		.trim()
		.toLowerCase()
		.replace(/^[a-z]+:\/\//, "")
		.split(/[/?#]/, 1)[0]
		.replace(/\.$/, "");

/** The hosts web search may return pages from; read-only without `onChange`. */
export const AllowedDomainsField = ({
	value,
	onChange,
	disabled,
}: {
	value: readonly string[];
	onChange?: (next: string[]) => void;
	disabled?: boolean;
}) => {
	const id = useId();
	const [draft, setDraft] = useState("");
	const [error, setError] = useState<string>();
	const full = value.length >= WEB_SEARCH_MAX_ALLOWED_DOMAINS;

	const add = () => {
		const parsed = webSearchDomainSchema.safeParse(toDomain(draft));
		if (!parsed.success) {
			setError(m.feature_web_search_domain_invalid());
			return;
		}
		if (!value.includes(parsed.data)) {
			onChange?.([
				...value,
				parsed.data,
			]);
		}
		setDraft("");
		setError(undefined);
	};

	return (
		<Field>
			<FieldLabel htmlFor={id}>
				{m.feature_web_search_domains_label()}
			</FieldLabel>
			<FieldDescription>
				{value.length === 0
					? m.feature_web_search_domains_empty_description()
					: m.feature_web_search_domains_description()}
			</FieldDescription>
			{value.length > 0 && (
				<ul
					aria-label={m.feature_web_search_domains_label()}
					className="flex flex-wrap gap-1.5"
				>
					{value.map((domain) => (
						<li key={domain}>
							<Badge variant="secondary" className="gap-1 pe-1">
								{domain}
								{onChange && (
									<button
										type="button"
										className="rounded-sm p-0.5 hover:bg-muted"
										aria-label={m.feature_web_search_domain_remove({
											domain,
										})}
										disabled={disabled}
										onClick={() =>
											onChange(value.filter((other) => other !== domain))
										}
									>
										<XIcon className="size-3" />
									</button>
								)}
							</Badge>
						</li>
					))}
				</ul>
			)}
			{onChange && (
				<InputGroup>
					<InputGroupInput
						id={id}
						value={draft}
						placeholder="example.org"
						disabled={disabled || full}
						aria-invalid={error !== undefined}
						onChange={(event) => {
							setDraft(event.target.value);
							setError(undefined);
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								add();
							}
						}}
					/>
					<InputGroupAddon align="inline-end">
						<InputGroupButton
							disabled={disabled || full || draft.trim() === ""}
							onClick={add}
						>
							<PlusIcon />
							{m.feature_web_search_domain_add()}
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			)}
			{error && <FieldError>{error}</FieldError>}
		</Field>
	);
};
