import { Link } from "@tanstack/react-router";
import { InfoIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { m } from "@/paraglide/messages";

/** A form page: the title and the form share one centred column. */
const FormPage = ({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) => (
	<Page>
		<PageHeader className="mx-auto w-full max-w-3xl">
			<PageTitle>{title}</PageTitle>
		</PageHeader>
		<PageContent className="mx-auto w-full max-w-3xl">{children}</PageContent>
	</Page>
);

/** A titled card grouping related fields. */
const FormSection = ({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: React.ReactNode;
}) => {
	const id = useId();

	return (
		<section
			aria-labelledby={`${id}-title`}
			className="rounded-3xl border bg-card shadow-xs"
		>
			<header className="flex flex-col gap-1 border-b px-4 py-4 sm:px-6">
				<h2 id={`${id}-title`} className="font-heading font-semibold text-base">
					{title}
				</h2>
				{description && (
					<p className="text-muted-foreground text-sm leading-normal">
						{description}
					</p>
				)}
			</header>
			<div className="flex flex-col gap-5 p-4 sm:p-6">{children}</div>
		</section>
	);
};

/** Two related fields side by side from sm, their controls aligned on a subgrid. */
const FormPair = ({ children }: { children: React.ReactNode }) => (
	<div className="grid gap-5 sm:grid-cols-2 sm:gap-y-3 sm:*:row-span-3 sm:*:grid sm:*:grid-rows-subgrid">
		{children}
	</div>
);

/** A note about the whole form, above its actions. */
const FormNotice = ({ children }: { children: React.ReactNode }) => (
	<p className="flex items-start gap-2 px-1 text-muted-foreground text-sm">
		<InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
		{children}
	</p>
);

/** Cancel returns to the parent page; the submit button comes as the child. */
const FormActions = ({ children }: { children: React.ReactNode }) => (
	<div className="flex justify-end gap-2">
		<Button variant="ghost" nativeButton={false} render={<Link to=".." />}>
			{m.common_cancel_button()}
		</Button>
		{children}
	</div>
);

export { FormActions, FormNotice, FormPage, FormPair, FormSection };
