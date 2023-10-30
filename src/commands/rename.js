const { SlashCommandBuilder } = require('discord.js');
const utils = require('../lib/utils');

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
    const { getGuild } = utils(client);
    const focusedValue = interaction.options.getFocused();

    const conn = await client.db.getConnection();
    const results = await conn.query('SELECT name, message_id FROM sound WHERE guild_id = ? AND name LIKE ? ORDER BY name LIMIT 25', [
      (await getGuild(interaction.guildId)).id,
      `%${focusedValue}%`,
    ]);
    conn.release();

    await interaction.respond(
      results.map((result) => ({
        name: result.name,
        value: String(result.message_id),
      })),
    );
  },

  async execute(interaction) {
    const { getGuild, getSound } = utils(client);
    await interaction.deferReply({ ephemeral: true });

    const { guildId } = interaction;
    const messageId = interaction.options.getString('soundboard');
    const newName = interaction.options.getString('name').slice(0, 255);

    const conn = await client.db.getConnection();
    const isUnique = (await conn.query('SELECT COUNT(*) as total FROM sound WHERE guild_id = ? AND name = ?', [(await getGuild(guildId)).id, newName]))[0].total === 0n;

    if (!await getSound(messageId)) return interaction.editReply('Invalid soundboard provided');

    if (isUnique) {
      // Update sound entry in db
      await conn.query('UPDATE sound SET name = ? WHERE message_id = ?', [
        newName,
        messageId,
      ]);

      // Invalidate cache
      client.cache.del(`s-${messageId}`);

      // Update message text
      const soundboardChannelId = (await getGuild(guildId)).soundboard;
      const soundboardChannel = await client.channels.fetch(soundboardChannelId);
      const message = await soundboardChannel.messages.fetch(messageId);
      message.edit(newName);

      await interaction.editReply(`Updated soundboard to \`${newName}\` successfully!`);
    } else {
      await interaction.editReply('Soundboard names must be unique.');
    }

    conn.release();
  },
});
