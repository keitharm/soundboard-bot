const {
  SlashCommandBuilder, ChannelType, PermissionsBitField,
  ThreadAutoArchiveDuration,
} = require('discord.js');

module.exports = (client) => ({
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set the channel you want Soundboard Bot to use')
    .addChannelOption((option) => option
      .setName('channel')
      .addChannelTypes(ChannelType.GuildText)
      .setDescription('Channel for Soundboard Bot to use')
      .setRequired(true)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.editReply('You must be an administrator to run this command.');
    }

    const fetchedChannel = await interaction.guild.channels.fetch(channel.id);

    // See if we need to create the thread
    const oldThread = fetchedChannel.threads.cache.find((x) => x.name === 'Soundboard Upload');

    let thread;
    if (oldThread) {
      thread = oldThread;
    } else {
      thread = await fetchedChannel.threads.create({
        name: 'Soundboard Upload',
        autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
        type: ChannelType.PrivateThread,
        reason: 'Channel for adding new soundboards',
      });
    }

    // Send welcome message
    const welcomeMsg = await channel.send(`Welcome to Soundboard bot! Join a voice channel and react to any of the messages below to play the chosen soundboard.
Go to <#${thread.id}> to add new soundboards. React to ❌ to stop current soundboard and 🔄 to restart soundboard if it's not working.`);
    await welcomeMsg.react('❌');
    await welcomeMsg.react('🔄');

    // Send thread message for new threads only
    if (!oldThread) {
      await thread.members.add(interaction.user.id);
      await thread.send(`To add a new soundboard with an associated name, upload an mp3 file and provide the name as your message body.
If you want to upload a sound file for use in another command (e.g. replacing a previous soundboard), upload a file with no message body and reference the uploaded file by right clicking and copying its id.`);
    }
    await interaction.editReply(`Set Soundboard channel to <#${channel.id}>. ${!oldThread ? `Created new <#${thread.id}> thread in channel for adding new soundboards.` : `Skipped thread creation since <#${thread.id}> already exists.`}`);

    const conn = await client.db.getConnection();
    await conn.query('UPDATE guild SET soundboard_channel = ?, upload_thread = ?, welcome_message = ? WHERE discord_id = ?', [
      channel.id,
      thread.id,
      welcomeMsg.id,
      interaction.guildId,
    ]);
    conn.release();

    client.guildMapping.set(interaction.guildId, {
      soundboard: channel.id,
      upload: thread.id,
      welcome: welcomeMsg.id,
      id: client.guildMapping.get(interaction.guildId).id,
      name: client.guildMapping.get(interaction.guildId).name,
    });
  },
});
