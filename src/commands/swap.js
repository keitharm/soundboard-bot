const { SlashCommandBuilder } = require('discord.js');
const utils = require('../lib/utils');

module.exports = (client) => ({
  data: new SlashCommandBuilder()
    .setName('swap')
    .setDescription('Swap the positions of 2 soundboards')
    .addStringOption((option) => option
      .setName('soundboard_1')
      .setDescription('Soundboard 1 to swap')
      .setAutocomplete(true)
      .setRequired(true))
    .addStringOption((option) => option
      .setName('soundboard_2')
      .setDescription('Soundboard 2 to swap')
      .setAutocomplete(true)
      .setRequired(true)),

  async autocomplete(interaction) {
    const conn = await client.db.getConnection();

    let other;
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === 'soundboard_1') {
      other = interaction.options.getString('soundboard_2');
    } else if (focusedOption.name === 'soundboard_2') {
      other = interaction.options.getString('soundboard_1');
    }
    const results = (await conn.query('SELECT name, message_id FROM sound WHERE guild_id = ? AND name LIKE ? ORDER BY name LIMIT 25', [
      client.guildMapping.get(interaction.guildId).id,
      `%${focusedOption.value}%`,
    ])).filter((result) => result.message_id !== other);

    conn.release();

    await interaction.respond(
      results.map((result) => ({ name: result.name, value: String(result.message_id) })),
    );
  },

  async execute(interaction) {
    const { generateRandomHex } = utils(client);
    await interaction.deferReply({ ephemeral: true });

    const { guildId } = interaction;
    const soundboard1 = interaction.options.getString('soundboard_1');
    const soundboard2 = interaction.options.getString('soundboard_2');

    // If user provided valid/different options
    if (client.soundMapping.has(soundboard1) && client.soundMapping.has(soundboard2) && soundboard1 !== soundboard2) {
      const conn = await client.db.getConnection();
      const sounds = await conn.query('SELECT message_id, name, id FROM sound WHERE message_id IN (?, ?)', [
        soundboard1,
        soundboard2,
      ]);

      // Swap message_ids of sounds
      [sounds[0].message_id, sounds[1].message_id] = [sounds[1].message_id, sounds[0].message_id];

      // Set message_id to random value due to unique constraint before correction after
      await Promise.all(sounds.map(async (sound) => {
        await conn.query('UPDATE sound SET message_id = ? WHERE id = ?', [generateRandomHex(20), sound.id]);
      }));

      // Swap db values
      await Promise.all(sounds.map(async (sound) => {
        await conn.query('UPDATE sound SET message_id = ? WHERE id = ?', [sound.message_id, sound.id]);
      }));

      conn.release();

      // Update local entry and messages in soundboard channel
      const soundboardChannelId = client.guildMapping.get(guildId).soundboard;
      const soundboardChannel = await client.channels.fetch(soundboardChannelId);
      await Promise.all(sounds.map(async (sound) => {
        client.soundMapping.set(sound.message_id, {
          ...client.soundMapping.get(sound.message_id),
          id: sound.id,
          name: sound.name,
        });

        const message = await soundboardChannel.messages.fetch(sound.message_id);
        await message.edit(sound.name);
      }));

      return interaction.editReply('Successfully swapped soundboards.');
    }
    return interaction.editReply('An error occured, please check that you have provided valid soundboards that are different from each other.');
  },
});
