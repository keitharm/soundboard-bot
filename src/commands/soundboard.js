const { SlashCommandBuilder } = require('discord.js');
const utils = require('../lib/utils');

module.exports = (client) => ({
  data: new SlashCommandBuilder()
    .setName('soundboard')
    .setDescription('Play specific sound')
    .addStringOption((option) => option
      .setName('soundboard')
      .setDescription('Play specified soundboard')
      .setAutocomplete(true)
      .setRequired(true)),

  async autocomplete(interaction) {
    const { getGuild } = utils(client);

    const { guildId } = interaction;
    const focusedValue = interaction.options.getFocused();
    const conn = await client.db.getConnection();
    const allSounds = await conn.query('SELECT name, message_id FROM sound WHERE guild_id = ? ORDER BY name', [
      (await getGuild(guildId)).id,
    ]);
    conn.release();
    
    const focusedWords = focusedValue.toLowerCase().split(' ');
    
    const filteredResults = allSounds.filter(result => {
      const resultWords = result.name.toLowerCase().split(' ');
      return focusedWords.every(focusedWord =>
        resultWords.some(resultWord => resultWord.includes(focusedWord))
      );
    });
    
    await interaction.respond(
      filteredResults.map((result) => ({
        name: result.name,
        value: String(result.message_id),
      })).slice(0, 25),
    );
  },

  async execute(interaction) {
    const { playSound, getSound } = utils(client);

    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const messageId = interaction.options.getString('soundboard');
    const user = await client.users.fetch(interaction.user.id);

    if (!await getSound(messageId)) return interaction.reply('Soundboard was not found');

    try {
      const { soundboard } = await getGuild(guildId);
      await playSound(client, {
        messageId,
        guildId,
        userId: interaction.user.id,
        username: user.username,
      });

      await interaction.editReply(`Played soundboard https://discord.com/channels/${guildId}/${soundboard}/${messageId}`);
    } catch (err) {
      await interaction.editReply('Please join a voice channel before playing a soundboard.');
    }
  },
});
