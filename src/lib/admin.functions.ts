import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, generatePassword, writeAudit } from "@/lib/admin.server";

const createUserSchema = z.object({
  full_name: z.string().min(1).max(100),
  username: z
    .string()
    .regex(/^[a-z0-9_]{3,20}$/)
    .nullable()
    .optional(),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: z.enum(["student", "faculty", "admin"]),
  branch_id: z.string().uuid().nullable(),
  semester: z.number().int().min(1).max(8).nullable(),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let branchName: string | null = null;
    if (data.branch_id) {
      const { data: branch } = await supabaseAdmin
        .from("branches")
        .select("name")
        .eq("id", data.branch_id)
        .maybeSingle();
      branchName = branch?.name ?? null;
    }

    if (data.username) {
      const { data: taken } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("username", data.username)
        .maybeSingle();
      if (taken) throw new Error("That username is already taken");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, username: data.username ?? undefined },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");

    await supabaseAdmin.from("profiles").upsert({
      id: created.user.id,
      full_name: data.full_name,
      email: data.email,
      semester: data.semester,
      branch: branchName,
      branch_id: data.branch_id,
      status: "active",
    });
    if (data.username) {
      await supabaseAdmin
        .from("profiles")
        .update({ username: data.username })
        .eq("id", created.user.id);
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });

    await writeAudit(
      context.supabase,
      context.userId,
      "User Created",
      data.email,
      `Role: ${data.role}`,
    );
    return { id: created.user.id };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.id === context.userId) throw new Error("You cannot delete your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.id)
      .maybeSingle();
    const { disconnectTelegramForUser } = await import("@/lib/telegram.server");
    await disconnectTelegramForUser(data.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    await writeAudit(
      context.supabase,
      context.userId,
      "User Deleted",
      profile?.email ?? data.id,
      "All user data removed",
    );
    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = generatePassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { password });
    if (error) throw new Error(error.message);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.id)
      .maybeSingle();
    await writeAudit(
      context.supabase,
      context.userId,
      "Password Reset",
      profile?.email ?? data.id,
      "Temporary password issued",
    );
    return { password };
  });

export const adminSetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), password: z.string().min(8).max(72) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.id)
      .maybeSingle();
    await writeAudit(
      context.supabase,
      context.userId,
      "Password Changed",
      profile?.email ?? data.id,
      "Admin set a new password",
    );
    return { ok: true };
  });
