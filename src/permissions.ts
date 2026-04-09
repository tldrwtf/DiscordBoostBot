import type { GuildMember } from "discord.js";

import type { BotConfig, OrderRecord } from "./types.js";
import { getStaffRoleIds } from "./config.js";

export function memberHasRole(member: GuildMember, roleId: string): boolean {
  return member.roles.cache.has(roleId);
}

export function isStaffMember(member: GuildMember, config: BotConfig): boolean {
  return getStaffRoleIds(config).some((roleId) => memberHasRole(member, roleId));
}

export function isBoosterMember(member: GuildMember, config: BotConfig): boolean {
  return memberHasRole(member, config.serverBoostersRoleId);
}

export function canCompleteOrder(member: GuildMember, order: OrderRecord, config: BotConfig): boolean {
  return isStaffMember(member, config) || member.id === order.assignedBoosterId;
}
