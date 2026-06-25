const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder, AttachmentBuilder
} = require('discord.js');
const { pool, getActiveSprint, getParticipant, getParticipantBooks, getSprintResults } = require('../db/database');
const { generateLeaderboard } = require('./leaderboard');

// ─── PANELS ────────────────────────────────────────────────────────────────

async function sendAdminPanel(channel, sprint = null) {
  const embed = new EmbedBuilder()
    .setTitle('📚 Reading Sprint — Admin Panel')
    .setColor(0xD79A96)
    .setDescription(sprint?.status === 'active'
      ? `**Sprint is running!**\nStarted: <t:${Math.floor(new Date(sprint.start_time).getTime() / 1000)}:R>`
      : sprint?.status === 'scheduled'
      ? `**Sprint scheduled!**\nStarts: <t:${Math.floor(new Date(sprint.scheduled_start).getTime() / 1000)}:F>`
      : 'No sprint running. Use the buttons below to manage sprints.'
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sprint_schedule').setLabel('📅 Schedule Sprint').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sprint_start').setLabel('▶️ Start Now').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('sprint_end').setLabel('⏹️ End Sprint').setStyle(ButtonStyle.Danger)
  );

  return channel.send({ embeds: [embed], components: [row] });
}

async function sendUserPanel(channel, sprint) {
  const embed = new EmbedBuilder()
    .setTitle('📖 Reading Sprint is Live!')
    .setColor(0xD4AF37)
    .setDescription('Click **Join** to participate in this reading sprint!');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sprint_join').setLabel('📖 Join Sprint').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('sprint_edit_leave').setLabel('✏️ Edit / Leave').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sprint_pause').setLabel('⏸️ Pause').setStyle(ButtonStyle.Primary)
  );

  return channel.send({ embeds: [embed], components: [row] });
}

// ─── MODALS ────────────────────────────────────────────────────────────────

function buildScheduleModal() {
  return new ModalBuilder()
    .setCustomId('modal_schedule')
    .setTitle('Schedule a Reading Sprint')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('schedule_date')
          .setLabel('Date (DD.MM.YYYY)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 25.06.2026')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('schedule_start')
          .setLabel('Start Time (HH:MM)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 14:00')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('schedule_end')
          .setLabel('End Time (HH:MM)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 20:00')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('schedule_repeat')
          .setLabel('Repeat? (none / daily / weekly)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('none')
          .setRequired(false)
      )
    );
}

function buildJoinModal() {
  return new ModalBuilder()
    .setCustomId('modal_join')
    .setTitle('Join Reading Sprint')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('join_book_title')
          .setLabel('Book Title')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('join_format')
          .setLabel('Format (book / ebook / audiobook)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('book')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('join_start_page')
          .setLabel('Current Page / Minute you are on')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 0')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('join_total_pages')
          .setLabel('Total Pages / Total Minutes of book')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('join_goal')
          .setLabel('Reading Goal (pages/min) — optional')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('e.g. 50')
      )
    );
}

function buildEditLeaveModal(currentBook) {
  return new ModalBuilder()
    .setCustomId('modal_edit_leave')
    .setTitle('Edit Progress / Leave Sprint')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('edit_end_page')
          .setLabel(`Current page/minute (was: ${currentBook?.start_page ?? 0})`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('edit_goal_reached')
          .setLabel('Did you reach your goal? (yes / no)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('no')
          .setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('edit_next_action')
          .setLabel('What next? (stay / next_book / leave)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('stay')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('edit_next_book')
          .setLabel('Next Book Title (if next_book selected)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('edit_next_start_page')
          .setLabel('Next Book Start Page (if next_book selected)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('0')
      )
    );
}

// ─── HANDLERS ──────────────────────────────────────────────────────────────

async function handleScheduleModal(interaction) {
  const date = interaction.fields.getTextInputValue('schedule_date').trim();
  const startTime = interaction.fields.getTextInputValue('schedule_start').trim();
  const endTime = interaction.fields.getTextInputValue('schedule_end').trim();
  const repeat = interaction.fields.getTextInputValue('schedule_repeat').trim().toLowerCase() || 'none';

  // Parse date/time
  const [day, month, year] = date.split('.');
  const scheduledStart = new Date(`${year}-${month}-${day}T${startTime}:00`);
  const scheduledEnd = new Date(`${year}-${month}-${day}T${endTime}:00`);

  if (isNaN(scheduledStart) || isNaN(scheduledEnd)) {
    return interaction.reply({ content: '❌ Invalid date or time format. Use DD.MM.YYYY and HH:MM.', ephemeral: true });
  }
  if (scheduledStart < new Date()) {
    return interaction.reply({ content: '❌ Start time is in the past!', ephemeral: true });
  }

  const existing = await getActiveSprint();
  if (existing) {
    return interaction.reply({ content: '❌ There is already an active or scheduled sprint!', ephemeral: true });
  }

  await pool.query(
    `INSERT INTO sprints (status, scheduled_start, scheduled_end) VALUES ('scheduled', $1, $2)`,
    [scheduledStart, scheduledEnd]
  );

  await interaction.reply({ content: `✅ Sprint scheduled!\n📅 **${date}** from **${startTime}** to **${endTime}**\n🔁 Repeat: **${repeat}**`, ephemeral: true });

  // Schedule auto-start
  const msUntilStart = scheduledStart.getTime() - Date.now();
  const msUntilEnd = scheduledEnd.getTime() - Date.now();

  setTimeout(() => startSprint(interaction.client, interaction.channelId), msUntilStart);
  setTimeout(() => endSprint(interaction.client, interaction.channelId), msUntilEnd);
}

async function handleJoinModal(interaction) {
  const sprint = await getActiveSprint();
  if (!sprint || sprint.status !== 'active') {
    return interaction.reply({ content: '❌ No active sprint right now.', ephemeral: true });
  }

  const existing = await getParticipant(sprint.id, interaction.user.id);
  if (existing) {
    return interaction.reply({ content: '❌ You are already in this sprint! Use **Edit / Leave** to update.', ephemeral: true });
  }

  const title = interaction.fields.getTextInputValue('join_book_title').trim();
  const format = interaction.fields.getTextInputValue('join_format').trim().toLowerCase() || 'book';
  const startPage = parseInt(interaction.fields.getTextInputValue('join_start_page').trim()) || 0;
  const totalPages = parseInt(interaction.fields.getTextInputValue('join_total_pages').trim()) || 0;
  const goalRaw = interaction.fields.getTextInputValue('join_goal').trim();
  const goal = goalRaw ? parseInt(goalRaw) : null;

  const partRes = await pool.query(
    `INSERT INTO sprint_participants (sprint_id, user_id, username, join_time, goal_pages)
     VALUES ($1, $2, $3, NOW(), $4) RETURNING id`,
    [sprint.id, interaction.user.id, interaction.user.username, goal]
  );
  const participantId = partRes.rows[0].id;

  await pool.query(
    `INSERT INTO sprint_books (participant_id, sprint_id, user_id, title, format, start_page, total_pages, order_num)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
    [participantId, sprint.id, interaction.user.id, title, format, startPage, totalPages]
  );

  // Update global user stats
  await pool.query(
    `INSERT INTO user_stats (user_id, username) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET username = $2`,
    [interaction.user.id, interaction.user.username]
  );

  await interaction.reply({
    content: `✅ You joined the sprint!\n📖 **${title}** (${format})\n📄 Starting on page **${startPage}**${goal ? `\n🎯 Goal: **${goal} pages**` : ''}`,
    ephemeral: true
  });
}

async function handleEditLeaveModal(interaction) {
  const sprint = await getActiveSprint();
  if (!sprint || sprint.status !== 'active') {
    return interaction.reply({ content: '❌ No active sprint.', ephemeral: true });
  }

  const participant = await getParticipant(sprint.id, interaction.user.id);
  if (!participant) {
    return interaction.reply({ content: '❌ You are not in this sprint.', ephemeral: true });
  }

  const books = await getParticipantBooks(participant.id);
  const currentBook = books[books.length - 1];
  if (!currentBook) {
    return interaction.reply({ content: '❌ No book found for your entry.', ephemeral: true });
  }

  const endPage = parseInt(interaction.fields.getTextInputValue('edit_end_page').trim()) || currentBook.start_page;
  const goalReachedRaw = interaction.fields.getTextInputValue('edit_goal_reached').trim().toLowerCase();
  const goalReached = goalReachedRaw === 'yes';
  const nextAction = interaction.fields.getTextInputValue('edit_next_action').trim().toLowerCase() || 'stay';
  const nextBookTitle = interaction.fields.getTextInputValue('edit_next_book').trim();
  const nextStartPage = parseInt(interaction.fields.getTextInputValue('edit_next_start_page').trim()) || 0;

  const isFinished = endPage >= (currentBook.total_pages || Infinity);

  // Update current book
  await pool.query(
    `UPDATE sprint_books SET end_page = $1, finished = $2 WHERE id = $3`,
    [endPage, isFinished, currentBook.id]
  );

  // Update goal
  await pool.query(
    `UPDATE sprint_participants SET goal_reached = $1 WHERE id = $2`,
    [goalReached, participant.id]
  );

  if (nextAction === 'leave') {
    // Calculate pause time
    let totalPauseMs = Number(participant.total_pause_ms) || 0;
    if (participant.is_paused && participant.pause_start) {
      totalPauseMs += Date.now() - new Date(participant.pause_start).getTime();
    }
    await pool.query(
      `UPDATE sprint_participants SET active = FALSE, leave_time = NOW(), total_pause_ms = $1 WHERE id = $2`,
      [totalPauseMs, participant.id]
    );
    return interaction.reply({ content: `👋 You left the sprint. Pages read: **${endPage - currentBook.start_page}**`, ephemeral: true });

  } else if (nextAction === 'next_book' && nextBookTitle) {
    const nextOrder = books.length + 1;
    await pool.query(
      `INSERT INTO sprint_books (participant_id, sprint_id, user_id, title, format, start_page, total_pages, order_num)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [participant.id, sprint.id, interaction.user.id, nextBookTitle, currentBook.format, nextStartPage, currentBook.total_pages, nextOrder]
    );
    return interaction.reply({ content: `📖 Switched to **${nextBookTitle}**, starting on page **${nextStartPage}**!`, ephemeral: true });

  } else {
    return interaction.reply({ content: `✅ Progress saved! You're on page **${endPage}**.`, ephemeral: true });
  }
}

async function handlePause(interaction) {
  const sprint = await getActiveSprint();
  if (!sprint || sprint.status !== 'active') {
    return interaction.reply({ content: '❌ No active sprint.', ephemeral: true });
  }

  const participant = await getParticipant(sprint.id, interaction.user.id);
  if (!participant) {
    return interaction.reply({ content: '❌ You are not in this sprint.', ephemeral: true });
  }

  if (participant.is_paused) {
    // Unpause
    const pausedMs = Date.now() - new Date(participant.pause_start).getTime();
    await pool.query(
      `UPDATE sprint_participants SET is_paused = FALSE, pause_start = NULL, total_pause_ms = total_pause_ms + $1 WHERE id = $2`,
      [pausedMs, participant.id]
    );
    return interaction.reply({ content: '▶️ Unpaused! Your timer is running again.', ephemeral: true });
  } else {
    // Pause
    await pool.query(
      `UPDATE sprint_participants SET is_paused = TRUE, pause_start = NOW() WHERE id = $1`,
      [participant.id]
    );
    return interaction.reply({ content: '⏸️ Paused! Your time is not counting until you unpause.', ephemeral: true });
  }
}

// ─── SPRINT LIFECYCLE ──────────────────────────────────────────────────────

async function startSprint(client, channelId) {
  const channel = await client.channels.fetch(channelId);
  if (!channel) return;

  const sprintRes = await pool.query(
    `UPDATE sprints SET status = 'active', start_time = NOW() WHERE status = 'scheduled' RETURNING *`
  );
  if (!sprintRes.rows.length) return;

  await channel.send({ content: '@here 📚 **The Reading Sprint has started! Join now!**' });
  await sendUserPanel(channel, sprintRes.rows[0]);
}

async function endSprint(client, channelId) {
  const channel = await client.channels.fetch(channelId);
  if (!channel) return;

  const sprint = await getActiveSprint();
  if (!sprint || sprint.status !== 'active') return;

  await pool.query(`UPDATE sprints SET status = 'ended', end_time = NOW() WHERE id = $1`, [sprint.id]);

  // Set leave_time for anyone still active
  await pool.query(
    `UPDATE sprint_participants SET leave_time = NOW(), active = FALSE
     WHERE sprint_id = $1 AND active = TRUE`,
    [sprint.id]
  );

  await channel.send({ content: '@here ⏹️ **The sprint has ended!** You have **5 minutes** to update your final page count using the **Edit / Leave** button above.' });

  // Wait 5 minutes then post leaderboard
  setTimeout(async () => {
    await postLeaderboard(client, channelId, sprint);
  }, 5 * 60 * 1000);
}

async function postLeaderboard(client, channelId, sprint) {
  const channel = await client.channels.fetch(channelId);
  if (!channel) return;

  const results = await getSprintResults(sprint.id);
  if (!results.length) {
    return channel.send('📊 No participants recorded for this sprint.');
  }

  // Fetch avatar URLs
  for (const r of results) {
    try {
      const member = await channel.guild.members.fetch(r.user_id);
      r.avatar_url = member.user.displayAvatarURL({ extension: 'png', size: 128 });
    } catch {
      r.avatar_url = null;
    }
  }

  const sprintDuration = sprint.end_time && sprint.start_time
    ? new Date(sprint.end_time) - new Date(sprint.start_time)
    : 0;

  const imageBuffer = await generateLeaderboard(results, sprintDuration);
  const attachment = new AttachmentBuilder(imageBuffer, { name: 'leaderboard.png' });

  await channel.send({ content: '@here 🏆 **Sprint Leaderboard!**', files: [attachment] });

  // Update all-time stats
  for (const r of results) {
    await pool.query(
      `INSERT INTO user_stats (user_id, username, total_pages_all_time)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET total_pages_all_time = user_stats.total_pages_all_time + $3,
           username = $2,
           last_updated = NOW()`,
      [r.user_id, r.username, Number(r.pages_read) || 0]
    );
  }

  // Reset sprint state after 1 hour
  setTimeout(async () => {
    await pool.query(`UPDATE sprints SET status = 'idle' WHERE id = $1`, [sprint.id]);
  }, 60 * 60 * 1000);
}

module.exports = {
  sendAdminPanel,
  sendUserPanel,
  buildScheduleModal,
  buildJoinModal,
  buildEditLeaveModal,
  handleScheduleModal,
  handleJoinModal,
  handleEditLeaveModal,
  handlePause,
  startSprint,
  endSprint
};
