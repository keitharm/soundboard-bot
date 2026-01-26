const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = (client) => ({
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the current soundboard'),

  async execute(interaction) {
    const { guildId } = interaction;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    client.player.get(guildId)?.stop();
    await interaction.editReply('Stopped soundboard playback');
  },
});
