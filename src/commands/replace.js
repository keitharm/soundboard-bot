const { SlashCommandBuilder } = require('discord.js');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');
const path = require('path');

const streamPipeline = promisify(pipeline);

module.exports = (client) => ({
  data: new SlashCommandBuilder()
    .setName('replace')
    .setDescription('Replace a soundboard with a new sound')
    .addStringOption((option) => option
      .setName('soundboard')
      .setDescription('Soundboard to replace')
      .setAutocomplete(true)
      .setRequired(true))
    .addStringOption((option) => option
      .setName('message_id')
      .setDescription('Message ID containing the sound file you want to use')
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
    const soundboard = interaction.options.getString('soundboard');
    const newSoundMsgId = interaction.options.getString('message_id');

    if (!client.soundMapping.has(soundboard)) return interaction.editReply('Invalid soundboard provided.');

    const uploadChannelId = client.guildMapping.get(guildId).upload;
    const uploadChannel = await client.channels.fetch(uploadChannelId);

    let message;
    try {
      message = await uploadChannel.messages.fetch(newSoundMsgId);
    } catch (err) {
      return interaction.editReply('Invalid message_id provided.');
    }
    const sound = message.attachments?.first()?.attachment ?? null;
    if (!sound) return interaction.editReply('No sound file attachment was found for provided message_id.');
    if (sound.slice(-4) !== '.mp3') return interaction.editReply('Only MP3 files are supported.');

    // Update src of db record
    const conn = await client.db.getConnection();
    await conn.query('UPDATE sound SET src = ? WHERE message_id = ?', [
      sound,
      soundboard,
    ]);
    conn.release();

    // Download and save file
    const response = await fetch(sound);
    await streamPipeline(response.body, createWriteStream(path.join(__dirname, '..', '..', 'sounds', `${client.soundMapping.get(soundboard).id}.mp3`)));
    await interaction.editReply('Updated soundboard successfully!');
  },
});
