const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
} = process.env;

const commands = [];
// Grab all the command files from the commands directory you created earlier
const commandsPath = path.join(__dirname, '..', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
commandFiles.forEach((file) => {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const command = require(`../commands/${file}`)({});
  commands.push(command.data.toJSON());
});

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

module.exports = async () => {
  // and deploy your commands!
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationCommands(DISCORD_CLIENT_ID),
      { body: commands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
};
