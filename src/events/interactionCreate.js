const {
  buildScheduleModal, buildJoinModal, buildEditLeaveModal,
  handleScheduleModal, handleJoinModal, handleEditLeaveModal,
  handlePause, startSprint, endSprint
} = require('../utils/sprintManager');
const { getActiveSprint, getParticipant, getParticipantBooks } = require('../db/database');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ── BUTTONS ─────────────────────────────────────────────────────────────
    if (interaction.isButton()) {

      // ADMIN: Schedule sprint
      if (interaction.customId === 'sprint_schedule') {
        return interaction.showModal(buildScheduleModal());
      }

      // ADMIN: Start sprint manually
      if (interaction.customId === 'sprint_start') {
        const existing = await getActiveSprint();
        if (existing?.status === 'active') {
          return interaction.reply({ content: '❌ A sprint is already running!', ephemeral: true });
        }

        const { pool } = require('../db/database');
        // End any scheduled sprint first
        await pool.query(`UPDATE sprints SET status = 'idle' WHERE status = 'scheduled'`);
        // Create new active sprint with no scheduled end (manual end required)
        await pool.query(`INSERT INTO sprints (status, start_time) VALUES ('active', NOW())`);

        await interaction.reply({ content: '✅ Sprint started manually!', ephemeral: true });

        const { sendUserPanel } = require('../utils/sprintManager');
        await sendUserPanel(interaction.channel, await getActiveSprint());
        await interaction.channel.send({ content: '@here 📚 **A Reading Sprint has started! Join now!**' });
        return;
      }

      // ADMIN: End sprint manually
      if (interaction.customId === 'sprint_end') {
        const sprint = await getActiveSprint();
        if (!sprint || sprint.status !== 'active') {
          return interaction.reply({ content: '❌ No active sprint to end.', ephemeral: true });
        }
        await interaction.reply({ content: '⏹️ Ending sprint...', ephemeral: true });
        await endSprint(client, interaction.channelId);
        return;
      }

      // USER: Join sprint
      if (interaction.customId === 'sprint_join') {
        const sprint = await getActiveSprint();
        if (!sprint || sprint.status !== 'active') {
          return interaction.reply({ content: '❌ No active sprint right now.', ephemeral: true });
        }
        const existing = await getParticipant(sprint.id, interaction.user.id);
        if (existing) {
          return interaction.reply({ content: '❌ You are already in the sprint! Use **Edit / Leave** to update your progress.', ephemeral: true });
        }
        return interaction.showModal(buildJoinModal());
      }

      // USER: Edit / Leave
      if (interaction.customId === 'sprint_edit_leave') {
        const sprint = await getActiveSprint();
        if (!sprint || sprint.status !== 'active') {
          return interaction.reply({ content: '❌ No active sprint.', ephemeral: true });
        }
        const participant = await getParticipant(sprint.id, interaction.user.id);
        if (!participant) {
          return interaction.reply({ content: '❌ You have not joined this sprint yet.', ephemeral: true });
        }
        const books = await getParticipantBooks(participant.id);
        const currentBook = books[books.length - 1];
        return interaction.showModal(buildEditLeaveModal(currentBook));
      }

      // USER: Pause / Unpause
      if (interaction.customId === 'sprint_pause') {
        return handlePause(interaction);
      }
    }

    // ── MODALS ───────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {

      if (interaction.customId === 'modal_schedule') {
        return handleScheduleModal(interaction);
      }

      if (interaction.customId === 'modal_join') {
        return handleJoinModal(interaction);
      }

      if (interaction.customId === 'modal_edit_leave') {
        return handleEditLeaveModal(interaction);
      }
    }
  }
};
