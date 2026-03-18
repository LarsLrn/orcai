import { ExternalLinkIcon } from "lucide-react";
import type { ReactElement } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const AboutModal = ({ children }: { children: ReactElement }) => {
	return (
		<Dialog>
			<DialogTrigger render={children} />
			<DialogContent className="max-h-10/12 max-w-2xl">
				<DialogHeader>
					<DialogTitle>What is OrcAI?</DialogTitle>
				</DialogHeader>

				<ScrollArea className="max-h-75 w-full sm:max-h-125">
					<div className="flex flex-col gap-4">
						<p>
							OrcAI is a prototype platform for building and using AI-supported
							applications with shared content, reusable components, and
							configurable access controls.
						</p>
						<p>
							It supports retrieval-augmented workflows, configurable AI
							behaviour, and reusable content collections that can be adapted to
							different courses, communities, and organisational use cases.
						</p>
						<p>
							The current prototype is a fork and voluntary continuation of the
							a KI:edu.nrw applied-project{" "}
							<a href="https://github.com/SokratesT/sokratest">Sokratest</a>,
							which was developed at Rhine-Waal University.
						</p>
						<p>
							If you have any questions or feedback, please do not hesitate to
							reach out to us directly via{" "}
							<a
								className="text-accent"
								href="mailto:sokratest@hochschule-rhein-waal.de"
							>
								sokratest@hochschule-rhein-waal.de
							</a>
						</p>

						<div className="mt-4 flex justify-center gap-4">
							<a
								href="https://www.hochschule-rhein-waal.de/de/fakultaeten/kommunikation-und-umwelt/forschungsprojekte/sokratest"
								className={cn(
									buttonVariants({
										variant: "outline",
										size: "sm",
									}),
								)}
								target="_blank"
								rel="noopener"
							>
								About Sokratesᵗ
								<ExternalLinkIcon className="size-3.5" />
							</a>
							<a
								href="https://ki-edu-nrw.ruhr-uni-bochum.de/ueber-das-projekt/phase-2/praxis-transferprojekte/aktuelle-praxisprojekte/#sokratest"
								className={buttonVariants({
									variant: "outline",
									size: "sm",
								})}
								target="_blank"
								rel="noopener"
							>
								About KI:edu.nrw
								<ExternalLinkIcon className="size-3.5" />
							</a>
						</div>
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
};

export { AboutModal };
