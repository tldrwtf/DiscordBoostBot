import path from "node:path";
import { config as loadEnv } from "dotenv";

import type { BotConfig } from "./types.js";
import { requireEnv, toOptional } from "./utils.js";

loadEnv();

export function loadConfig(): BotConfig {
  const eurToUsdRate = Number(process.env.EUR_TO_USD_RATE ?? "1.08");
  if (!Number.isFinite(eurToUsdRate) || eurToUsdRate <= 0) {
    throw new Error("EUR_TO_USD_RATE must be a positive number.");
  }

  return {
    token: requireEnv("DISCORD_TOKEN", process.env.DISCORD_TOKEN),
    clientId: requireEnv("DISCORD_CLIENT_ID", process.env.DISCORD_CLIENT_ID ?? process.env.CLIENT_ID),
    guildId: requireEnv("DISCORD_GUILD_ID", process.env.DISCORD_GUILD_ID ?? process.env.GUILD_ID),
    orderHereChannelId: requireEnv("ORDER_HERE_CHANNEL_ID", process.env.ORDER_HERE_CHANNEL_ID),
    boostTicketCategoryId: requireEnv("BOOST_TICKET_CATEGORY_ID", process.env.BOOST_TICKET_CATEGORY_ID),
    claimOrdersChannelId: requireEnv("CLAIM_ORDERS_CHANNEL_ID", process.env.CLAIM_ORDERS_CHANNEL_ID),
    completedJobsChannelId: requireEnv("COMPLETED_JOBS_CHANNEL_ID", process.env.COMPLETED_JOBS_CHANNEL_ID),
    auditLogChannelId: toOptional(process.env.AUDIT_LOG_CHANNEL_ID),
    supportRoleId: requireEnv("SUPPORT_ROLE_ID", process.env.SUPPORT_ROLE_ID),
    managerRoleId: requireEnv("MANAGER_ROLE_ID", process.env.MANAGER_ROLE_ID),
    adminRoleId: requireEnv("ADMIN_ROLE_ID", process.env.ADMIN_ROLE_ID),
    serverBoostersRoleId: requireEnv("SERVER_BOOSTERS_ROLE_ID", process.env.SERVER_BOOSTERS_ROLE_ID),
    eurToUsdRate,
    databasePath: path.resolve(process.cwd(), process.env.DATABASE_PATH ?? "./data/orders.sqlite"),
    embedFooter: "Elite Boosters",
    rootDir: process.cwd(),
  };
}

export function getStaffRoleIds(config: BotConfig): string[] {
  return [config.supportRoleId, config.managerRoleId, config.adminRoleId];
}
