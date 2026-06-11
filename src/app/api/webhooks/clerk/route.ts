import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

function primaryEmail(data: {
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
}): string | undefined {
  return data.email_addresses?.find((e) => e.id === data.primary_email_address_id)
    ?.email_address ?? data.email_addresses?.[0]?.email_address;
}

export async function POST(req: NextRequest) {
  // verifyWebhook valida la firma svix. OJO: el default del SDK lee
  // CLERK_WEBHOOK_SIGNING_SECRET; nuestra env se llama CLERK_WEBHOOK_SECRET,
  // así que se pasa explícito.
  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    evt = await verifyWebhook(req, {
      signingSecret: process.env.CLERK_WEBHOOK_SECRET,
    });
  } catch (err) {
    console.error("[clerk-webhook] Signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createClient();

  try {
    if (evt.type === "user.created") {
      const { id } = evt.data;
      const email = primaryEmail(evt.data);

      if (!email) {
        console.error("[clerk-webhook] user.created without email", { id });
        return new Response("Missing email", { status: 400 });
      }

      // Upsert: the page-level getOrCreateProfile fallback may have already
      // created the row if the user hit the app before this webhook arrived.
      const { error } = await supabase.from("profiles").upsert(
        {
          clerk_user_id: id,
          email,
          status: "active",
          subscription_weeks: 0,
          weekly_limit: 0,
        },
        { onConflict: "clerk_user_id" }
      );

      if (error) {
        console.error("[clerk-webhook] Failed to insert profile", error);
        return new Response("DB error", { status: 500 });
      }

      console.log(`[clerk-webhook] Profile created for ${email} (clerk_user_id=${id})`);
    }

    if (evt.type === "user.updated") {
      const { id } = evt.data;
      const email = primaryEmail(evt.data);

      if (!email) {
        console.error("[clerk-webhook] user.updated without email", { id });
        return new Response("Missing email", { status: 400 });
      }

      const { error } = await supabase
        .from("profiles")
        .update({ email })
        .eq("clerk_user_id", id);

      if (error) {
        console.error("[clerk-webhook] Failed to update profile", error);
        return new Response("DB error", { status: 500 });
      }

      console.log(`[clerk-webhook] Profile updated for ${email} (clerk_user_id=${id})`);
    }

    if (evt.type === "user.deleted") {
      const { id } = evt.data;
      if (!id) {
        return new Response("Missing user id", { status: 400 });
      }

      // Soft delete: mark as deleted and zero out subscription
      // We do NOT hard delete to preserve any subscription/payment history
      const { error } = await supabase
        .from("profiles")
        .update({
          status: "deleted",
          subscription_weeks: 0,
          subscription_end: null,
        })
        .eq("clerk_user_id", id);

      if (error) {
        console.error("[clerk-webhook] Failed to soft-delete profile", error);
        return new Response("DB error", { status: 500 });
      }

      console.log(`[clerk-webhook] Profile soft-deleted (clerk_user_id=${id})`);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[clerk-webhook] Unexpected error", err);
    return new Response("Internal error", { status: 500 });
  }
}
