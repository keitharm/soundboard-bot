const { createAudioPlayer } = require('@discordjs/voice');
const { CronJob } = require('cron');
const { version } = require('../../package.json');
const utils = require('./utils');

module.exports = async (client) => {
  const { log, db, syncHistory } = utils(client);

  client.vc = null;
  client.timeout = null;
  client.player = createAudioPlayer();
  client.resource = null;
  client.db = db;
  client.conn = await db.getConnection();
  client.log = log();
  client.guildMapping = new Map();
  client.userMapping = new Map();
  client.soundMapping = new Map();
  client.history = [];

  client.log(`Initializing Soundboard Bot version ${version}`);

  client.log('Loading guildMapping');
  const guilds = await client.conn.query('SELECT id, discord_id, soundboard_channel, upload_channel, welcome_message FROM guild');
  guilds.forEach((guild) => {
    client.guildMapping.set(guild.discord_id, {
      id: guild.id,
      soundboard: guild.soundboard_channel,
      upload: guild.upload_channel,
      welcome: guild.welcome_message,
    });
  });

  client.log('Loading userMapping');
  const users = await client.conn.query('SELECT id, discord_id from user');
  users.forEach((user) => {
    client.userMapping.set(user.discord_id, user.id);
  });

  client.log('Loading soundMapping');
  const sounds = await client.conn.query('SELECT id, message_id from sound');
  sounds.forEach((sound) => {
    client.soundMapping.set(sound.message_id, sound.id);
  });

  // Cron jobs
  client.jobs = {
    // Push latest history stats to db
    syncHistory: new CronJob(
      '0 * * * * *',
      syncHistory,
      null,
      true,
      'America/Chicago',
    ),
  };
};
