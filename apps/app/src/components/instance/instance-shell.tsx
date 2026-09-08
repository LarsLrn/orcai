import type { ReactNode } from "react";
import { Header } from "@/components/app/header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { InstanceSidebar } from "./instance-sidebar";

const InstanceShell = ({ children }: { children: ReactNode }) => (
	<SidebarProvider>
		<InstanceSidebar />
		<SidebarInset className="max-w-full">
			<Header homeTo="/instance" />
			<main className="p-6">{children}</main>
		</SidebarInset>
	</SidebarProvider>
);

export { InstanceShell };
