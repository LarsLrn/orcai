import { createFileRoute, Link } from "@tanstack/react-router";
import { FileTextIcon } from "lucide-react";
import { DataExportCard } from "@/components/account/data-export-card";
import { buttonVariants } from "@/components/ui/button";
import { PageContent } from "@/components/ui/shell/page";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/account/data")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<PageContent className="flex max-w-2xl flex-col gap-8">
			<DataExportCard />
			<div className="flex flex-col gap-2">
				<p className="text-xl">{m.account_legal_title()}</p>
				<div className="flex gap-2">
					<Link
						className={buttonVariants({
							variant: "outline",
						})}
						to={"/privacy"}
						target="_blank"
					>
						<FileTextIcon /> {m.account_legal_privacy_link()}
					</Link>
					<Link
						className={buttonVariants({
							variant: "outline",
						})}
						to={"/tou"}
						target="_blank"
					>
						<FileTextIcon /> {m.account_legal_terms_link()}
					</Link>
				</div>
			</div>
		</PageContent>
	);
}
