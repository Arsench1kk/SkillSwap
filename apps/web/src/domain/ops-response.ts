import { messages } from "@/messages/en";

export function opsReplyMessage(
  configuredHours = process.env.OPS_REPLY_HOURS,
): string | null {
  if (!configuredHours || !/^\d+$/.test(configuredHours)) return null;
  return messages.briefOpsReplyHours.replace("{hours}", configuredHours);
}
