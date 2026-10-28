import type { ReactNode } from "react";
import { Header } from "@/components/app/header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { InstanceSidebar } from "./instance-sidebar";

const InstanceShell = ({ children }: { children: ReactNode }) => (
	<SidebarProvider>
		<InstanceSidebar />
		<SidebarInset className="max-w-full">
			<Header homeTo="/instance" />
			<div className="isolate p-6">{children}</div>
		</SidebarInset>
	</SidebarProvider>
);

export { InstanceShell };
