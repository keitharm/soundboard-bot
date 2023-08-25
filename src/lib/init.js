const fs = require('fs-extra');
const path = require('path');
const NodeCache = require('node-cache');
const { version } = require('../../package.json');
const utils = require('./utils');

module.exports = async (client) => {
  const { db, log } = utils(client);

  client.db = db;
  client.log = log();
  client.log(`Initializing Soundboard Bot version ${version}`);

  // Guild voice connections
  client.vc = new Map();

  // Player associated with each guild
  client.player = new Map();

  // Timeout for disconnecting after configured amount of time
  client.timeout = new Map();

  // Determine when to delete cached sounds
  client.cache = new NodeCache({
    stdTTL: 3600,
    checkperiod: 60,
  })
    .on('del', async (key) => {
      if (key.startsWith('f-')) {
        await fs.promises.unlink(path.join(__dirname, '..', '..', 'cache', `${key.slice(2)}.mp3`));
      }
    });

  // Clear cache directory before start
  client.log('Clearing cache on init');
  fs.emptyDirSync(path.join(__dirname, '..', '..', 'cache'));

  const conn = await db.getConnection();

  const guilds = (await conn.query('SELECT COUNT(*) AS total FROM guild'))[0].total;
  client.log(`Loaded ${guilds} guild${guilds === 1 ? '' : 's'}`);

  const users = (await conn.query('SELECT COUNT(*) AS total FROM user'))[0].total;
  client.log(`Loaded ${users} user${users === 1 ? '' : 's'}`);

  const sounds = (await conn.query('SELECT COUNT(*) AS total FROM sound'))[0].total;
  client.log(`Loaded ${sounds} sound${sounds === 1 ? '' : 's'}`);

  conn.release();
};
