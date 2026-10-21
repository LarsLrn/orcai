import { useRouteContext } from "@tanstack/react-router";
import { CheckIcon, LanguagesIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth/auth-client";
import { toAuthError } from "@/lib/errors/auth-error";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { m } from "@/paraglide/messages";
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
	const { auth } = useRouteContext({
		from: "__root__",
	});

	const onChange = (locale: Locale) => {
		startTransition(async () => {
			if (auth.isAuthenticated) {
				const result = await authClient.updateUser({
					locale,
				});
				if (result.error) {
					toast.error(m.header_locale_switcher_toast_error(), {
						description: reasonMessageOf(toAuthError(result.error)),
					});
					return;
				}
			}
			setLocale(locale);
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						className="size-8"
						disabled={isPending}
						size="icon"
						variant="ghost"
					>
						<LanguagesIcon className="h-6 w-6" aria-hidden="true" />
						<span className="sr-only">{label}</span>
					</Button>
				}
			/>
			<DropdownMenuContent positionMethod="fixed">
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
