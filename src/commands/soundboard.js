const { SlashCommandBuilder } = require('discord.js');
const utils = require('../lib/utils');

module.exports = (client) => ({
  data: new SlashCommandBuilder()
    .setName('soundboard')
    .setDescription('Play specific sound')
    .addStringOption((option) => option
      .setName('name')
      .setDescription('Play specified soundboard')
      .setAutocomplete(true)
      .setRequired(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();

    const conn = await client.db.getConnection();
    const results = await conn.query('SELECT name, message_id FROM sound WHERE guild_id = ? AND name LIKE ? ORDER BY name LIMIT 25', [
      client.guildMapping.get(interaction.guildId).id,
      `%${focusedValue}%`,
    ]);
    conn.release();

    await interaction.respond(
      results.map((result) => ({ name: result.name, value: String(result.message_id) })),
    );
  },

  async execute(interaction) {
    const { playSound } = utils(client);
    await interaction.deferReply({ ephemeral: true });

    const messageId = interaction.options.getString('name');
    const user = await client.users.fetch(interaction.user.id);

    if (!client.soundMapping.has(messageId)) return interaction.reply('Soundboard was not found');

    try {
      await playSound(client, {
        messageId,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: user.username,
      });

      await interaction.editReply('Played soundboard');
    } catch (err) {
      await interaction.editReply('Please join a voice channel before playing a soundboard.');
    }
  },
});
