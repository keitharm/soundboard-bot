const crypto = require('crypto');
const path = require('path');
const mariadb = require('mariadb');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');
const { joinVoiceChannel, createAudioResource, createAudioPlayer } = require('@discordjs/voice');

const streamPipeline = promisify(pipeline);

const {
  MARIADB_DATABASE,
  MARIADB_USER,
  MARIADB_PASSWORD,
} = process.env;

const db = mariadb.createPool({
  host: 'db',
  database: MARIADB_DATABASE,
  user: MARIADB_USER,
  password: MARIADB_PASSWORD,
});

module.exports = (client) => {
  function log() {
    return (msg) => {
      console.log(`[${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}] ${msg}`);
    };
  }

  async function checkUser(userId, username) {
    // Add user to db if not in mapping
    if (!client.userMapping.has(userId)) {
      const conn = await client.db.getConnection();
      const res = await conn.query('INSERT INTO user (discord_id, username) VALUES (?, ?) RETURNING id', [userId, username]);
      client.userMapping.set(userId, {
        id: res[0].id,
        username,
      });
      conn.release();
      client.log(`[${username}] Added user.`);
    }
  }

  async function playSound(client, {
    messageId, guildId, userId, username,
  }) {
    clearTimeout(client.timeout.get(guildId));

    // Add user to db if not in mapping
    await checkUser(userId, username);

    // Connect/reconnect to vc
    await reconnectVc(userId, guildId);

    // Cache hit
    const cacheHit = client.cache.has(messageId);
    if (cacheHit) {
      // Refresh ttl
      client.cache.ttl(messageId, 900);
    } else {
      // Download and save file
      const response = await fetch(client.soundMapping.get(messageId).src);
      await streamPipeline(response.body, createWriteStream(path.join(__dirname, '..', '..', 'cache', `${messageId}.mp3`)));

      // Set cache key
      client.cache.set(messageId, true);
    }

    const resource = createAudioResource(path.join(__dirname, '..', '..', 'cache', `${messageId}.mp3`));
    client.player.get(guildId).play(resource);
    client.log(`[${username}] [${client.guildMapping.get(guildId).name}] Played sound ${client.soundMapping.get(messageId).name} (cached = ${cacheHit ? 'true' : 'false'}).`);

    // Add history entry
    const conn = await client.db.getConnection();
    await conn.query('INSERT INTO history (timestamp, guild_id, sound_id, user_id) VALUES (FROM_UNIXTIME(?), ?, ?, ?)', [
      Date.now().toString().slice(0, -3),
      client.guildMapping.get(guildId).id,
      client.soundMapping.get(messageId).id,
      client.userMapping.get(userId).id,
    ]);
    conn.release();

    // Start disconnect timeout after 15 minutes of no soundboard activity
    client.timeout.set(guildId, setTimeout(() => {
      client.vc.get(guildId)?.disconnect();
      client.vc.set(guildId, null);
    }, 900000));
  }

  async function reconnectVc(userId, guildId) {
    // eslint-disable-next-line no-underscore-dangle
    if (client.vc.get(guildId)?._state?.status === 'disconnected') return client.vc.get(guildId).rejoin();
    // eslint-disable-next-line no-underscore-dangle
    if (client.vc.get(guildId)?._state?.status === 'ready') return;

    // Get VC user making sound
    const rawvc = client.guilds.resolve(guildId).voiceStates.cache.find((i) => i.id === userId);
    if (rawvc && rawvc.channelId) {
      const channel = await client.channels.fetch(rawvc.channelId);
      client.vc.set(guildId, joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
      }));

      if (!client.player.has(guildId)) client.player.set(guildId, createAudioPlayer());
      client.vc.get(guildId).subscribe(client.player.get(guildId));
    } else {
      throw new Error('User was not in voice channel - ignoring play request.');
    }
  }

  async function deleteSound(client, { messageId, guildId }) {
    const sound = client.soundMapping.get(messageId);
    const conn = await client.db.getConnection();

    // Remove entry from db and soundMapping
    await conn.query('DELETE FROM sound WHERE id = ?', [sound.id]);
    client.soundMapping.delete(messageId);
    conn.release();
    client.log(`[n/a] [${client.guildMapping.get(guildId).name}] Deleted sound ${sound.name}.`);
  }

  function generateRandomHex(length) {
    const bytes = Math.ceil(length / 2);
    return crypto.randomBytes(bytes).toString('hex').slice(0, length);
  }

  return {
    log,
    db,
    checkUser,
    playSound,
    deleteSound,
    reconnectVc,
    generateRandomHex,
  };
};
