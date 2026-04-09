import { REST, Routes } from "discord.js";

import { commands } from "../commands.js";
import { loadConfig } from "../config.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const rest = new REST({ version: "10" }).setToken(config.token);

  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: commands,
  });

  console.log(`Registered ${commands.length} guild command(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
