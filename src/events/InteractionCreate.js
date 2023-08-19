module.exports = (client) => async (interaction) => {
  const guildName = client.guilds.resolve(interaction.guildId).name;
  const { username } = interaction.user;

  if (!interaction.isChatInputCommand()) return;
  client.log(`[${username}] Ran command ${interaction.commandName} in guild ${guildName}`);

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
};
