import { Webhook } from "svix";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkUserEvent = {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string;
    email_addresses?: ClerkEmailAddress[];
    primary_email_address_id?: string;
    deleted?: boolean;
  };
};

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: ClerkUserEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkUserEvent;
  } catch (err) {
    console.error("[clerk-webhook] Signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = await createClient();

  try {
    if (evt.type === "user.created") {
      const { id, email_addresses, primary_email_address_id } = evt.data;
      const email = email_addresses?.find(
        (e) => e.id === primary_email_address_id
      )?.email_address;

      if (!email) {
        console.error("[clerk-webhook] user.created without email", { id });
        return new Response("Missing email", { status: 400 });
      }

      const { error } = await supabase.from("profiles").insert({
        clerk_user_id: id,
        email,
        status: "active",
        subscription_weeks: 0,
        weekly_limit: 0,
      });

      if (error) {
        console.error("[clerk-webhook] Failed to insert profile", error);
        return new Response("DB error", { status: 500 });
      }

      console.log(`[clerk-webhook] Profile created for ${email} (clerk_user_id=${id})`);
    }

    if (evt.type === "user.updated") {
      const { id, email_addresses, primary_email_address_id } = evt.data;
      const email = email_addresses?.find(
        (e) => e.id === primary_email_address_id
      )?.email_address;

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
