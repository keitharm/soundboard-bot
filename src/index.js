const fs = require('fs');
const path = require('path');
const {
  Client, Collection, Events,
  GatewayIntentBits, Partials,
} = require('discord.js');
const setup = require('./lib/setup');
const deployCommands = require('./lib/deployCommands');

const {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  DEPLOY = false,
} = process.env;
if (!DISCORD_TOKEN) process.exit('Discord Bot token missing');
if (DEPLOY) {
  if (!DISCORD_CLIENT_ID) process.exit('Discord client id missing');
  deployCommands();
}

(async () => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Reaction],
  });

  client.login(DISCORD_TOKEN);
  client.on(Events.ClientReady, async () => {
    // Attempt to exit gracefully when Discord.js throws the random error it sometimes does
    process.on('uncaughtException', async (err) => {
      client.log(`Caught exception: ${err}`);
      client.log(err.stack);
      process.exit();
    });

    process.on('SIGTERM', async () => {
      client.log('Caught interrupt signal');
      process.exit();
    });

    await setup(client);
    await finish();
    client.log('Ready!');
  });

  async function finish() {
    // Slash Commands
    client.commands = new Collection();
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath)(client);
      client.commands.set(command.data.name, command);
    }

    // Event Handling
    client.events = new Collection();
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));
    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const event = require(filePath);
      client.events.set(file.slice(0, -3), event);
    }

    client.on(Events.Error, client.events.get('Error')(client));
    client.on(Events.Raw, client.events.get('Raw')(client));
    client.on(Events.GuildCreate, client.events.get('GuildCreate')(client));
    client.on(Events.GuildDelete, client.events.get('GuildDelete')(client));
    client.on(Events.InteractionCreate, client.events.get('InteractionCreate')(client));
    client.on(Events.MessageCreate, client.events.get('MessageCreate')(client));
  }
})();
