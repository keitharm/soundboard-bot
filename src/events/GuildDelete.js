module.exports = (client) => async (guild) => {
  const res = await client.conn.query('DELETE FROM guild WHERE discord_id = ? RETURNING discord_id', [guild.id]);

  // Remove guild from guildMapping
  client.guildMapping.delete(res[0].discord_id);
};
