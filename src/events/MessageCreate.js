const utils = require('../lib/utils');

module.exports = (client) => async (msg) => {
  const { checkUser } = utils(client);

  // Ignore messages from bots
  if (msg.author.bot) return;

  const name = msg.content.trim();
  const guildId = msg.guild.id;
  const sound = msg.attachments?.first()?.attachment ?? null;
  const { id: userId, username } = msg.author;

  // If message not from soundboard and is in the soundboard channel, delete it
  if (client.user.id !== userId && msg.channel.id === client.guildMapping.get(msg.guildId).soundboard) {
    setTimeout(() => msg.delete(), 5000);
  }

  // Ignore messages not in the upload thread
  if (msg.channel.id !== client.guildMapping.get(msg.guildId).upload) return;

  // No attachments
  if (!sound) return;

  // Add user to db if not in mapping
  await checkUser(userId, username);

  // Attachment with text = new sound
  if (sound && name.length !== 0) {
    // Reject non-mp3 files
    if (sound.slice(-4) !== '.mp3') return msg.channel.send('Only MP3 files are supported');

    // Post new message into soundboard channel and save to db
    const soundMsg = await (await msg.guild.channels.fetch(client.guildMapping.get(guildId).soundboard)).send(name);
    const conn = await client.db.getConnection();
    const res = await conn.query('INSERT INTO sound (guild_id, message_id, user_id, name, src) VALUES (?, ?, ?, ?, ?) RETURNING id', [
      client.guildMapping.get(guildId).id,
      soundMsg.id,
      client.userMapping.get(userId).id,
      name,
      sound,
    ]);
    conn.release();

    client.log(`[${client.userMapping.get(userId).username}] [${client.guildMapping.get(guildId).name}] Added sound ${name}.`);

    // Add sound to soundMapping
    client.soundMapping.set(soundMsg.id, {
      id: res[0].id,
      guildId,
      name,
      src: sound,
    });

    await soundMsg.react('🔈');
    await msg.channel.send(`Added \`${name}\` to <#${client.guildMapping.get(guildId).soundboard}> successfully!`);
  }
};
