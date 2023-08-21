module.exports = (client) => async (guild) => {
  const conn = await client.db.getConnection();
  const res = await conn.query('DELETE FROM guild WHERE discord_id = ? RETURNING discord_id', [guild.id]);
  conn.release();

  client.log(`Deleted guild ${guild.name}.`);

  // Remove guild from guildMapping
  client.guildMapping.delete(res[0].discord_id);
};
