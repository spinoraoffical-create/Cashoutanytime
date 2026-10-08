"use server";

import { revalidatePath } from "next/cache";

import { sendScopedOffer } from "@/lib/offers/send";

export async function sendOfferAction(input: { subject: string; emailBody: string; smsBody: string }) {
  const result = await sendScopedOffer(input);
  if (result.ok) revalidatePath("/admin/offers");
  return result;
}
