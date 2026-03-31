import { CheckIcon, LanguagesIcon } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type Locale, setLocale } from "@/paraglide/runtime";

type Props = {
	defaultValue: string;
	items: Array<{
		value: Locale;
		label: string;
	}>;
	label: string;
};

const LocaleSwitcherSelect = ({ defaultValue, items, label }: Props) => {
	const [isPending, startTransition] = useTransition();

	const onChange = (value: Locale) => {
		const locale = value;
		startTransition(() => {
			setLocale(locale);
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						className={cn(
							"size-8",
							isPending && "pointer-events-none opacity-60",
						)}
						size="icon"
						variant="subtle"
					>
						<LanguagesIcon className="h-6 w-6" />
					</Button>
				}
			/>
			<DropdownMenuContent>
				<DropdownMenuGroup>
					<DropdownMenuLabel>{label}</DropdownMenuLabel>
					{items.map((item) => (
						<DropdownMenuItem
							key={item.value}
							onClick={() => onChange(item.value)}
						>
							<div className="mr-2 w-4">
								{item.value === defaultValue && (
									<CheckIcon className="h-5 w-5" />
								)}
							</div>
							<span>{item.label}</span>
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { LocaleSwitcherSelect };
