const utils = require('../lib/utils');

module.exports = (client) => async (packet) => {
  const { playSound, deleteSound } = utils(client);

  // Play sound for reactions
  if (['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t)) {
    const user = await client.users.fetch(packet.d.user_id);

    // Ignore bots
    if (user.bot) return;

    // Stop current soundboard request
    if (packet.d.emoji.name === '❌' && packet.d.message_id === client.guildMapping.get(packet.d.guild_id).welcome) {
      return client.player.get(packet.d.guild_id)?.stop();
    }

    // Restart soundboard
    if (packet.d.emoji.name === '🔄' && packet.d.message_id === client.guildMapping.get(packet.d.guild_id).welcome) {
      client.vc.get(packet.d.guild_id)?.disconnect();
      client.vc.set(packet.d.guild_id, null);
      return;
    }

    if (!client.soundMapping.has(packet.d.message_id)) return;

    await playSound(client, {
      messageId: packet.d.message_id,
      guildId: packet.d.guild_id,
      userId: packet.d.user_id,
      username: user.username,
    });

  // Check if deleted a soundboard message
  } else if (packet.t === 'MESSAGE_DELETE') {
    const validSound = client.soundMapping.has(packet.d.id);

    if (validSound) {
      await deleteSound(client, {
        messageId: packet.d.id,
        guildId: packet.d.guild_id,
      });
    }
  }
};
