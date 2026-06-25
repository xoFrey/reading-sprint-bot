const { sendAdminPanel } = require("../utils/sprintManager");
const { initDB, getActiveSprint } = require("../db/database");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);

    await initDB();
    // Re-schedule any pending sprints after restart
    const { pool } = require("../db/database");
    const { startSprint, endSprint } = require("../utils/sprintManager");

    const pending = await pool.query(
      `SELECT * FROM sprints WHERE status = 'scheduled'`,
    );

    for (const sprint of pending.rows) {
      const msUntilStart = new Date(sprint.scheduled_start) - Date.now();
      const msUntilEnd = new Date(sprint.scheduled_end) - Date.now();

      if (msUntilStart > 0) {
        setTimeout(() => startSprint(client, channelId), msUntilStart);
      } else if (msUntilEnd > 0) {
        // Should have already started, start now
        await startSprint(client, channelId);
        setTimeout(() => endSprint(client, channelId), msUntilEnd);
      }
    }

    const channelId = process.env.SPRINT_CHANNEL_ID;
    if (!channelId) return console.warn("⚠️ SPRINT_CHANNEL_ID not set in .env");

    try {
      const channel = await client.channels.fetch(channelId);
      const sprint = await getActiveSprint();
      await sendAdminPanel(channel, sprint);
      console.log(`📋 Admin panel sent to #${channel.name}`);
    } catch (err) {
      console.error("Failed to send admin panel:", err);
    }
  },
};
