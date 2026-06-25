const { sendAdminPanel } = require('../utils/sprintManager');
const { initDB, getActiveSprint } = require('../db/database');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);

    await initDB();

    const channelId = process.env.SPRINT_CHANNEL_ID;
    if (!channelId) return console.warn('⚠️ SPRINT_CHANNEL_ID not set in .env');

    try {
      const channel = await client.channels.fetch(channelId);
      const sprint = await getActiveSprint();
      await sendAdminPanel(channel, sprint);
      console.log(`📋 Admin panel sent to #${channel.name}`);
    } catch (err) {
      console.error('Failed to send admin panel:', err);
    }
  }
};
