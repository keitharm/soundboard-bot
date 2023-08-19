module.exports = (client) => async (guild) => {
  const res = await client.conn.query('INSERT INTO guild (discord_id, name) VALUES (?, ?) RETURNING id', [guild.id, guild.name]);

  // Add guild to guildMapping
  client.guildMapping.set(guild.id, {
    id: res[0].id,
  });

  (await guild.channels.fetch(guild.systemChannelId))
    .send('Thanks for adding Soundboard Bot! Remember to create (and setup using `/setchannel`) a dedicated text channel you want Soundboard Bot to use.');
};
