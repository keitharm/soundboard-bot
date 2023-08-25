const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');
const { exec } = require('child_process');
const { version } = require('../../package.json');
const utils = require('./utils');

module.exports = async (client) => {
  const { db, log } = utils(client);

  client.db = db;
  client.log = log();
  client.vc = new Map();
  client.player = new Map();
  client.timeout = new Map();
  client.guildMapping = new Map();
  client.userMapping = new Map();
  client.soundMapping = new Map();
  client.cache = new NodeCache({
    stdTTL: 3600,
  });
  client.cache.on('expired', async (key) => {
    await fs.promises.unlink(path.join(__dirname, '..', '..', 'cache', `${key}.mp3`));
  });

  client.log(`Initializing Soundboard Bot version ${version}`);

  client.log('Loading guildMapping');
  const conn = await db.getConnection();
  const guilds = await conn.query('SELECT id, name, discord_id, soundboard_channel, upload_thread, welcome_message FROM guild');
  guilds.forEach((guild) => {
    client.guildMapping.set(guild.discord_id, {
      id: guild.id,
      name: guild.name,
      soundboard: guild.soundboard_channel,
      upload: guild.upload_thread,
      welcome: guild.welcome_message,
    });
  });
  client.log(`Loaded ${client.guildMapping.size} guild${client.guildMapping.size === 1 ? '' : 's'}`);

  client.log('Loading userMapping');
  const users = await conn.query('SELECT id, username, discord_id from user');
  users.forEach((user) => {
    client.userMapping.set(user.discord_id, {
      id: user.id,
      username: user.username,
    });
  });
  client.log(`Loaded ${client.userMapping.size} user${client.userMapping.size === 1 ? '' : 's'}`);

  client.log('Loading soundMapping');
  const sounds = await conn.query('SELECT s.id AS id, g.discord_id AS guild_id, s.name, s.src, message_id from sound s JOIN guild g ON (g.id = s.guild_id)');
  sounds.forEach((sound) => {
    client.soundMapping.set(sound.message_id, {
      id: sound.id,
      guildId: sound.guild_id,
      name: sound.name,
      src: sound.src,
    });
  });
  client.log(`Loaded ${client.soundMapping.size} sound${client.soundMapping.size === 1 ? '' : 's'}`);

  client.log('Clearing cache on init');
  exec('rm /app/cache/*', () => {});

  conn.release();
};
