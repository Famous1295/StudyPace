import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { fetchMyRole } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/faculty")({
  beforeLoad: async () => {
    const role = await fetchMyRole();
    if (role !== "faculty" && role !== "admin") {
      toast.error("Faculty access only.");
      throw redirect({ to: "/dashboard" });
    }
  },
  component: () => <Outlet />,
});
