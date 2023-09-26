const utils = require('../lib/utils');

module.exports = (client, edited = false) => async (_msg) => {
  const {
    checkUser, getGuild, getUser,
  } = utils(client);

  const { guildId } = _msg;
  const { id: userId, username } = _msg.author;
  const sound = _msg.attachments?.first()?.attachment ?? null;
  const filename = _msg.attachments?.first()?.name;

  // Ignore messages from bots
  if (_msg.author.bot) return;

  // If message not from soundboard and is in the soundboard channel, delete it
  if (client.user.id !== userId && _msg.channel.id === (await getGuild(guildId)).soundboard) {
    return setTimeout(async () => {
      try {
        await _msg.delete();
      } catch (err) {
        client.log(`[${(await getUser(userId)).username}] [${(await getGuild(guildId)).name}] Missing permissions for deleting messages in soundboard channel.`);
      }
    }, 5000);
  }

  // No attachments
  if (!sound) return;

  let msg;
  // We manually refetch the message since Discord doesn't update the content of a message during a MessageUpdate event for some reason
  if (edited) {
    const soundboardChannelId = (await getGuild(guildId)).upload;
    const soundboardChannel = await client.channels.fetch(soundboardChannelId);
    msg = await soundboardChannel.messages.fetch(_msg.id);

    // Check if we've already processed this uploaded sound by seeing if the attachment src id is already in the db.
    // If we have, just ignore the message.
    const conn = await client.db.getConnection();
    const unused = (await conn.query('SELECT COUNT(*) as total FROM sound WHERE src = ?', [sound]))[0].total === 0n;
    conn.release();

    if (!unused) return;
  } else {
    msg = _msg;
  }

  const name = msg.content.trim();

  // Ignore messages not in the upload thread
  if (msg.channel.id !== (await getGuild(guildId)).upload) return;

  // Add user to db if not found
  await checkUser(userId, username);

  // Attachment with text = new sound
  if (sound && name.length !== 0) {
    // Reject non-mp3 files
    if (filename.slice(-4) !== '.mp3') return msg.channel.send('Only MP3 files are supported');

    const conn = await client.db.getConnection();

    // Make sure name is unique
    const isUnique = (await conn.query('SELECT COUNT(*) as total FROM sound WHERE guild_id = ? AND name = ?', [(await getGuild(guildId)).id, name]))[0].total === 0n;

    if (isUnique) {
      // Post new message into soundboard channel and save to db
      const soundMsg = await (await msg.guild.channels.fetch((await getGuild(guildId)).soundboard)).send(name);
      await conn.query('INSERT INTO sound (guild_id, message_id, user_id, name, src) VALUES (?, ?, ?, ?, ?) RETURNING id', [
        (await getGuild(guildId)).id,
        soundMsg.id,
        (await getUser(userId)).id,
        name,
        sound,
      ]);
      conn.release();

      client.log(`[${(await getUser(userId)).username}] [${(await getGuild(guildId)).name}] Added sound ${filename}.`);

      await soundMsg.react('🔈');
      await msg.channel.send(`Added \`${name}\` to <#${(await getGuild(guildId)).soundboard}> successfully!`);
    } else {
      await msg.channel.send(`\`${name}\` is already in use, please edit your previous sound upload message https://discord.com/channels/${guildId}/${msg.channel.id}/${msg.id} with a unique name.`);
    }
  }
};
