module.exports = (client) => async (guild) => {
  const conn = await client.db.getConnection();
  const res = await conn.query('INSERT INTO guild (discord_id, name) VALUES (?, ?) RETURNING id', [guild.id, guild.name]);
  conn.release();

  // Add guild to guildMapping
  client.guildMapping.set(guild.id, {
    id: res[0].id,
    name: guild.name,
  });

  client.log(`Added guild ${guild.name}.`);
  (await guild.channels.fetch(guild.systemChannelId))
    .send('Thanks for adding Soundboard Bot! Remember to create (and setup using `/setchannel`) a dedicated text channel you want Soundboard Bot to use.');
};
