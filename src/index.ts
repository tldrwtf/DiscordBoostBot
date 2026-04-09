import { Client, GatewayIntentBits, MessageFlags } from "discord.js";

import { commands } from "./commands.js";
import { loadConfig } from "./config.js";
import { OrdersRepository } from "./db/ordersRepository.js";
import { DraftStore } from "./draftStore.js";
import { InteractionHandler } from "./interactionHandler.js";

const config = loadConfig();
const repository = new OrdersRepository(config.databasePath);
const drafts = new DraftStore();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const handler = new InteractionHandler(client, config, repository, drafts);

client.once("ready", async (readyClient) => {
  if (!readyClient.application) {
    throw new Error("Discord application is not ready.");
  }

  await readyClient.application.commands.set(commands, config.guildId);
  console.log(`Logged in as ${readyClient.user.tag}`);
  
  const activeOrders = repository.listActive();
  console.log(`Recovered ${activeOrders.length} active order(s) from SQLite.`);

  const guild = readyClient.guilds.cache.get(config.guildId);
  if (guild) {
    for (const order of activeOrders) {
      await handler.syncTicketSummary(guild, order.id).catch((error) => {
        console.error(`Failed to sync ticket summary for ${order.id}`, error);
      });
    }
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handler.handleCommand(interaction);
      return;
    }

    if (interaction.isUserContextMenuCommand()) {
      await handler.handleUserContextMenu(interaction);
      return;
    }

    if (interaction.isButton()) {
      await handler.handleButton(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      await handler.handleSelect(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handler.handleModal(interaction);
    }
  } catch (error) {
    console.error(error);
    if (interaction.isRepliable()) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ flags: MessageFlags.Ephemeral, content: message });
      } else {
        await interaction.reply({ flags: MessageFlags.Ephemeral, content: message });
      }
    }
  }
});

client.on("messageCreate", async (message) => {
  try {
    await handler.handleMessage(message);
  } catch (error) {
    console.error("Failed to handle ticket message.", error);
  }
});

client.login(config.token).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
