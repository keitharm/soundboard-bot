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

    const resource = createAudioResource(path.join(__dirname, '..', '..', 'sounds', `${client.soundMapping.get(messageId).id}.mp3`));
    client.player.get(guildId).play(resource);
    client.log(`[${client.userMapping.get(userId).username}][${client.guildMapping.get(guildId).name}] Played sound ${client.soundMapping.get(messageId).name}.`);

    // Push to history array
    client.history.push([
      Date.now().toString().slice(0, -3),
      client.guildMapping.get(guildId).id,
      client.soundMapping.get(messageId).id,
      client.userMapping.get(userId).id,
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
      throw new Error('User was not in voice channel - ignoring play request.');
    }
  }

  async function deleteSound(client, soundMsgId) {
    const sound = client.soundMapping.get(soundMsgId);
    const conn = await client.db.getConnection();

    // Delete sound file
    await fs.unlink(path.join(__dirname, '..', '..', 'sounds', `${sound.id}.mp3`));

    // Remove entry from db and soundMapping
    await conn.query('DELETE FROM sound WHERE id = ?', [sound.id]);
    client.soundMapping.delete(soundMsgId);
    conn.release();
    client.log(`Deleted sound ${sound.name} (${sound.id}).`);
  }

  async function syncHistory() {
    const conn = await client.db.getConnection();
    await Promise.all(client.history.map(async (history) => {
      await conn.query('INSERT INTO history (timestamp, guild_id, sound_id, user_id) VALUES (FROM_UNIXTIME(?), ?, ?, ?)', history);
    }));
    conn.release();
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
