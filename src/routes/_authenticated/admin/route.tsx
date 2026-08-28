import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { fetchMyRole } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const role = await fetchMyRole();
    if (role !== "admin") {
      toast.error("You don't have permission to access this page.");
      throw redirect({ to: "/dashboard" });
    }
  },
  component: () => <Outlet />,
});
