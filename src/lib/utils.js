const fs = require('fs/promises');
const path = require('path');
const mariadb = require('mariadb');
const { joinVoiceChannel, createAudioResource, createAudioPlayer } = require('@discordjs/voice');

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
    return (msg, debug = false) => {
      const blacklisted = false;
      if (!blacklisted) {
        console.log(`[${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}] ${debug ? '[DEBUG] ' : ''}${msg}`);
      }
    };
  }

  async function checkUser(userId, username) {
    // Add user to db if not in mapping
    if (!client.userMapping.has(userId)) {
      const res = await client.conn.query('INSERT INTO user (discord_id, username) VALUES (?, ?) RETURNING id', [userId, username]);
      client.userMapping.set(userId, res[0].id);
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

    const resource = createAudioResource(path.join(__dirname, '..', '..', 'sounds', `${client.soundMapping.get(messageId)}.mp3`));
    client.player.get(guildId).play(resource);

    // Push to history array
    client.history.push([
      Date.now().toString().slice(0, -3),
      client.guildMapping.get(guildId).id,
      client.soundMapping.get(messageId),
      client.userMapping.get(userId),
    ]);

    // Start disconnect timeout after 15 minutes of no soundboard activity
    client.timeout.set(guildId, setTimeout(() => {
      client.vc.get(guildId)?.disconnect();
      client.vc.set(guildId, null);
    }, 900000));
  }

  async function reconnectVc(userId, guildId) {
    // eslint-disable-next-line no-underscore-dangle
    if (client.vc.get(guildId)?._state?.status === 'disconnected') return client.vc.get(guildId).rejoin();

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
      throw new Error('Please join a voice channel before playing a soundboard.');
    }
  }

  async function deleteSound(client, messageId) {
    // Delete sound file
    await fs.unlink(path.join(__dirname, '..', '..', 'sounds', `${messageId}.mp3`));

    // Remove entry from db and soundMapping
    await client.conn.query('DELETE FROM sound WHERE id = ?', [messageId]);
    client.soundMapping.delete(messageId);
  }

  async function syncHistory() {
    await Promise.all(client.history.map(async (history) => {
      await client.conn.query('INSERT INTO history (timestamp, guild_id, sound_id, user_id) VALUES (FROM_UNIXTIME(?), ?, ?, ?)', history);
    }));
    client.history = [];
  }

  return {
    log,
    db,
    checkUser,
    playSound,
    deleteSound,
    reconnectVc,
    syncHistory,
  };
};
