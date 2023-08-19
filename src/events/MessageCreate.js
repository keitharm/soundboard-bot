const { createWriteStream } = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');
const path = require('path');
const utils = require('../lib/utils');

const streamPipeline = promisify(pipeline);

module.exports = (client) => async (msg) => {
  const { checkUser } = utils(client);

  // Ignore messages from bots and messages not in the upload thread
  if (msg.author.bot || msg.channel.id !== client.guildMapping.get(msg.guildId).upload) return;

  const name = msg.content.trim();
  const guildId = msg.guild.id;
  const sound = msg.attachments?.first()?.attachment ?? null;
  const { id: userId, username } = msg.author;

  // No attachments
  if (!sound) return msg.channel.send('No sound file provided.');

  // Add user to db if not in mapping
  await checkUser(userId, username);

  // Attachment with text = new sound
  if (sound && name.length !== 0) {
    // Reject non-mp3 files
    if (sound.slice(-4) !== '.mp3') return msg.channel.send('Only MP3 files are supported');

    // Post new message into soundboard channel and save to db
    const soundMsg = await (await msg.guild.channels.fetch(client.guildMapping.get(guildId).soundboard)).send(name);
    const res = await client.conn.query('INSERT INTO sound (guild_id, message_id, author, name, src) VALUES (?, ?, ?, ?, ?) RETURNING id', [
      client.guildMapping.get(guildId).id,
      soundMsg.id,
      client.userMapping.get(userId),
      name,
      sound,
    ]);

    // Add sound to soundMapping
    client.soundMapping.set(soundMsg.id, res[0].id);

    // Download and save file
    const response = await fetch(sound);
    await streamPipeline(response.body, createWriteStream(path.join(__dirname, '..', '..', 'sounds', `${res[0].id}.mp3`)));
    await soundMsg.react('🔈');
  }

  await msg.channel.send(`Added \`${name}\` to <#${client.guildMapping.get(guildId).soundboard}> successfully!`);
};
