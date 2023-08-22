const { SlashCommandBuilder } = require('discord.js');

module.exports = (client) => ({
  data: new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Rename a soundboard')
    .addStringOption((option) => option
      .setName('soundboard')
      .setDescription('Soundboard to rename')
      .setAutocomplete(true)
      .setRequired(true))
    .addStringOption((option) => option
      .setName('name')
      .setDescription('New name for selected soundboard')
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
    await interaction.deferReply({ ephemeral: true });

    const { guildId } = interaction;
    const messageId = interaction.options.getString('soundboard');
    const newName = interaction.options.getString('name').slice(0, 255);
    const isUnique = ![...client.soundMapping.values()].find((s) => s.guildId === guildId && s.name === newName);

    if (!client.soundMapping.has(messageId)) return interaction.editReply('Invalid soundboard provided');

    if (isUnique) {
      const conn = await client.db.getConnection();

      // Update sound entry in db
      await conn.query('UPDATE sound SET name = ? WHERE message_id = ?', [
        newName,
        messageId,
      ]);
      conn.release();

      // Update local entry
      client.soundMapping.set(messageId, {
        ...client.soundMapping.get(messageId),
        name: newName,
      });

      // Update message text
      const soundboardChannelId = client.guildMapping.get(guildId).soundboard;
      const soundboardChannel = await client.channels.fetch(soundboardChannelId);
      const message = await soundboardChannel.messages.fetch(messageId);
      message.edit(newName);

      await interaction.editReply(`Updated soundboard to \`${newName}\` successfully!`);
    } else {
      await interaction.editReply('Soundboard names must be unique.');
    }
  },
});
