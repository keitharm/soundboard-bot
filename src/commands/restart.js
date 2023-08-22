const { SlashCommandBuilder } = require('discord.js');

module.exports = (client) => ({
  data: new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Restart the soundboard if it\'s not working'),

  async execute(interaction) {
    const { guildId } = interaction;

    await interaction.deferReply({ ephemeral: true });
    client.vc.get(guildId)?.disconnect();
    client.vc.set(guildId, null);
    await interaction.editReply('Restarted soundboard');
  },
});
