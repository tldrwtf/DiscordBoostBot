import { randomUUID } from "node:crypto";
import type { Attachment } from "discord.js";

const SUPPORTED_IMAGE_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]);
const SUPPORTED_IMAGE_FILE_PATTERN = /\.(png|jpe?g|gif|webp)$/i;

export function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function toOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number, currency: "USD" | "EUR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(roundMoney(amount));
}

export function createOrderId(): string {
  return `ord_${Date.now().toString(36)}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export function createTicketSuffix(): string {
  return randomUUID().replace(/-/g, "").slice(0, 6);
}

export function sanitizeChannelName(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

export function buildTicketChannelName(productId: string, username: string): string {
  const safeUser = sanitizeChannelName(username) || "customer";
  return `boost-${productId}-${safeUser}-${createTicketSuffix()}`.slice(0, 95);
}

export function isImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    return SUPPORTED_IMAGE_FILE_PATTERN.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function isImageAttachment(attachment: Attachment): boolean {
  const contentType = attachment.contentType?.toLowerCase();
  if (contentType && SUPPORTED_IMAGE_CONTENT_TYPES.has(contentType)) {
    return true;
  }

  return attachment.name ? SUPPORTED_IMAGE_FILE_PATTERN.test(attachment.name) : isImageUrl(attachment.url);
}
