import { Spinner } from "@/components/ui/spinner";

const LoadingPage = () => {
	return (
		<div className="flex flex-1 items-center justify-center">
			<Spinner className="size-8" />
		</div>
	);
};

export { LoadingPage };
