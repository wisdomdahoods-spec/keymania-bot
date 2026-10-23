const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionsBitField
} = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const TOKEN = process.env.DISCORD_BOT_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

const STOCK_FILE = 'keymania_stock.json';
const ACCOUNTS_FILE = 'keymania_accounts.json';

if (!fs.existsSync(STOCK_FILE)) fs.writeFileSync(STOCK_FILE, '{}');
if (!fs.existsSync(ACCOUNTS_FILE)) fs.writeFileSync(ACCOUNTS_FILE, '{}');

const load = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; }};
const save = (d, f) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

client.on('ready', () => {
  console.log(`✨ 𝐊𝐄𝐘𝐌𝐀𝐍𝐈𝐀 — 𝐋𝐈𝐕𝐄 ✨`);
  console.log(`✅ Logged in as: ${client.user.tag}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});

async function handleCmd(msg) {
  if (!msg.content.startsWith('!') || msg.author.bot) return;

  const isDM = !msg.guild;
  const lines = msg.content.split('\n').map(l => l.trim());
  const firstLine = lines[0];
  const cmdMatch = firstLine.match(/^!(\w+)\s*(.*)$/);
  if (!cmdMatch) return;

  const [, cmd, rest] = cmdMatch;
  const args = rest.trim().split(/\s+/).filter(Boolean);

  // ── !help ─────────────────────────────────────────────────
  if (cmd === 'help') {
    return msg.reply({ embeds: [
      new EmbedBuilder()
        .setTitle("✨ 𝐂𝐎𝐌𝐌𝐀𝐍𝐃 𝐆𝐔𝐈𝐃𝐄 ✨")
        .setColor(0x9B59B6)
        .setDescription("```\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n  ALL FORMATS & USAGE\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n```")
        .addFields(
          { name: "📦 !stock", value: "Check all stock levels\n`!stock`", inline: true },
          { name: "✅ !restock", value: "Add accounts — service on line 1, accounts below\n```!restock ServiceName\nemail:password\nemail2:password2\n```", inline: false },
          { name: "🎁 !genmenu", value: "Show dropdown generator (server only)\n`!genmenu`", inline: true },
          { name: "🔑 !gen", value: "Get account directly\n`!gen ServiceName`", inline: true },
          { name: "🗑️ !clearstock", value: "Remove all stock\n`!clearstock ServiceName`", inline: true }
        )
        .setFooter({ text: "Keymania • Premium Generator 💜" })
        .setTimestamp()
    ]});
  }

  // ── !stock ────────────────────────────────────────────────
  if (cmd === 'stock') {
    if (!isDM && !msg.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return msg.reply("❌ Admin only");

    const stock = load(STOCK_FILE);
    if (!Object.keys(stock).length) {
      return msg.reply({ embeds: [
        new EmbedBuilder().setDescription("📦 **Stock is empty.**\nUse `!restock` to add accounts.").setColor(0x2B2D31)
      ]});
    }

    const embed = new EmbedBuilder()
      .setTitle("📦 𝐒𝐓𝐎𝐂𝐊 𝐈𝐍𝐕𝐄𝐍𝐓𝐎𝐑𝐘")
      .setColor(0x9B59B6)
      .setTimestamp();

    for (const [service, count] of Object.entries(stock)) {
      const status = count > 5 ? "🟢" : count > 0 ? "🟡" : "🔴";
      embed.addFields({ name: `${status} ${service}`, value: `**${count}** available`, inline: true });
    }

    return msg.reply({ embeds: [embed] });
  }

  // ── !restock ───────────────────────────────────────────────
  if (cmd === 'restock') {
    if (!isDM && !msg.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return msg.reply("❌ Admin only");

    const service = rest.trim();
    if (!service) {
      return msg.reply({ embeds: [
        new EmbedBuilder()
          .setTitle("❌ 𝐈𝐍𝐕𝐀𝐋𝐈𝐃 𝐅𝐎𝐑𝐌𝐀𝐓")
          .setColor(0xE74C3C)
          .setDescription("```\nCORRECT FORMAT:\n!restock ServiceName\nemail1:password1\nemail2:password2\n```")
      ]});
    }

    const accountsToAdd = lines.slice(1).map(l => l.trim()).filter(l => l);
    if (!accountsToAdd.length) {
      return msg.reply({ embeds: [
        new EmbedBuilder().setDescription("❌ Paste accounts below the service name — one per line").setColor(0xE74C3C)
      ]});
    }

    const accounts = load(ACCOUNTS_FILE);
    if (!accounts[service]) accounts[service] = [];
    accounts[service].push(...accountsToAdd);
    save(accounts, ACCOUNTS_FILE);

    const stock = load(STOCK_FILE);
    stock[service] = accounts[service].length;
    save(stock, STOCK_FILE);

    return msg.reply({ embeds: [
      new EmbedBuilder()
        .setTitle("✅ 𝐑𝐄𝐒𝐓𝐎𝐂𝐊𝐄𝐃")
        .setColor(0x2ECC71)
        .addFields(
          { name: "Service", value: `\`${service}\``, inline: true },
          { name: "Added", value: `**${accountsToAdd.length}**`, inline: true },
          { name: "Total Stock", value: `**${stock[service]}**`, inline: true }
        )
        .setTimestamp()
    ]});
  }

  // ── !clearstock ────────────────────────────────────────────
  if (cmd === 'clearstock') {
    if (!isDM && !msg.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return msg.reply("❌ Admin only");

    const service = args[0];
    if (!service) {
      return msg.reply({ embeds: [
        new EmbedBuilder().setDescription("❌ Usage: `!clearstock ServiceName`").setColor(0xE74C3C)
      ]});
    }

    const accounts = load(ACCOUNTS_FILE);
    const stock = load(STOCK_FILE);
    delete accounts[service];
    delete stock[service];
    save(accounts, ACCOUNTS_FILE);
    save(stock, STOCK_FILE);

    return msg.reply({ embeds: [
      new EmbedBuilder().setTitle("🗑️ 𝐂𝐋𝐄𝐀𝐑𝐄𝐃").setDescription(`All stock for **${service}** removed.`).setColor(0xE74C3C).setTimestamp()
    ]});
  }

  // ── !genmenu ───────────────────────────────────────────────
  if (cmd === 'genmenu') {
    if (isDM) return msg.reply("❌ Use this command in the server channel");

    const stock = load(STOCK_FILE);
    const available = Object.entries(stock).filter(([_, c]) => c > 0);

    if (!available.length) {
      return msg.reply({ embeds: [
        new EmbedBuilder().setTitle("📦 𝐒𝐎𝐋𝐃 𝐎𝐔𝐓").setDescription("No stock available right now.").setColor(0xE74C3C)
      ]});
    }

    const options = available.map(([service, count]) => ({
      label: `${service} — ${count} in stock`,
      value: service,
      description: `Claim your ${service} account`
    }));

    const menu = new StringSelectMenuBuilder()
      .setCustomId('gen_select')
      .setPlaceholder("👇 𝐒𝐄𝐋𝐄𝐂𝐓 𝐘𝐎𝐔𝐑 𝐀𝐂𝐂𝐎𝐔𝐍𝐓")
      .addOptions(options);

    const embed = new EmbedBuilder()
      .setTitle("✨ 𝐊𝐄𝐘𝐌𝐀𝐍𝐈𝐀 — 𝐏𝐑𝐄𝐌𝐈𝐔𝐌 𝐆𝐄𝐍𝐄𝐑𝐀𝐓𝐎𝐑 ✨")
      .setColor(0xF1C40F)
      .setDescription("```\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n  Select below • Sent instantly • 100% Unique\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n```")
      .setTimestamp();

    for (const [service, count] of available) {
      embed.addFields({ name: `━━━ ${service}`, value: `> 📦 **${count}** in stock\n> ✅ Instant delivery\n> 🔒 Guaranteed unique`, inline: false });
    }

    const menuMsg = await msg.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    const collector = menuMsg.createMessageComponentCollector({ time: 0 });

    collector.on('collect', async interaction => {
      if (interaction.customId !== 'gen_select') return;
      const service = interaction.values[0];
      const accounts = load(ACCOUNTS_FILE);

      if (!accounts[service] || !accounts[service].length) {
        return interaction.reply({ embeds: [
          new EmbedBuilder().setDescription("❌ **SNAGGED!**\nSomeone just claimed it — try another.").setColor(0xE74C3C)
        ], ephemeral: true });
      }

      const claimed = accounts[service].shift();
      save(accounts, ACCOUNTS_FILE);
      const stock = load(STOCK_FILE);
      stock[service] = accounts[service].length;
      save(stock, STOCK_FILE);

      const dmEmbed = new EmbedBuilder()
        .setTitle("✨ 𝐘𝐎𝐔𝐑 𝐏𝐑𝐄𝐌𝐈𝐔𝐌 𝐀𝐂𝐂𝐎𝐔𝐍𝐓 ✨")
        .setColor(0x9B59B6)
        .setDescription("```\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n   ✅ CLAIMED — YOURS ALONE\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n```")
        .addFields(
          { name: "Service", value: `\`${service}\``, inline: false },
          { name: "Credentials", value: `\`\`\`${claimed}\`\`\``, inline: false },
          { name: "🔒 Security", value: "• Permanently removed from stock\n• No one else can claim it\n• Change password immediately", inline: false }
        )
        .setFooter({ text: "Keymania • Yours exclusively 💜" })
        .setTimestamp();

      try {
        await interaction.user.send({ embeds: [dmEmbed] });
        await interaction.reply({ embeds: [
          new EmbedBuilder().setDescription("✅ **CHECK YOUR DMS!** 📩\n🔒 Exclusively yours — no duplicates.").setColor(0x2ECC71)
        ], ephemeral: true });
      } catch {
        await interaction.reply({ embeds: [dmEmbed], ephemeral: true });
      }

      const freshStock = load(STOCK_FILE);
      const stillAvail = Object.entries(freshStock).filter(([_, c]) => c > 0);
      if (!stillAvail.length) {
        await menuMsg.edit({ embeds: [
          new EmbedBuilder().setDescription("```\n🔒 SOLD OUT — Check back soon!\n```").setColor(0xE74C3C)
        ], components: [] });
        collector.stop();
      }
    });
  }

  // ── !gen ───────────────────────────────────────────────────
  if (cmd === 'gen') {
    const service = args[0];
    if (!service) {
      return msg.reply({ embeds: [
        new EmbedBuilder().setDescription("❌ Usage: `!gen ServiceName`").setColor(0xE74C3C)
      ]});
    }

    const accounts = load(ACCOUNTS_FILE);
    if (!accounts[service] || !accounts[service].length) {
      return msg.reply({ embeds: [
        new EmbedBuilder().setDescription(`❌ No stock available for **${service}**`).setColor(0xE74C3C)
      ]});
    }

    const claimed = accounts[service].shift();
    save(accounts, ACCOUNTS_FILE);
    const stock = load(STOCK_FILE);
    stock[service] = accounts[service].length;
    save(stock, STOCK_FILE);

    const resultEmbed = new EmbedBuilder()
      .setTitle("✨ 𝐘𝐎𝐔𝐑 𝐏𝐑𝐄𝐌𝐈𝐔𝐌 𝐀𝐂𝐂𝐎𝐔𝐍𝐓 ✨")
      .setColor(0x9B59B6)
      .setDescription("```\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n   ✅ CLAIMED — YOURS ALONE\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n```")
      .addFields(
        { name: "Service", value: `\`${service}\``, inline: false },
        { name: "Credentials", value: `\`\`\`${claimed}\`\`\``, inline: false },
        { name: "🔒 Status", value: "Permanently removed — exclusively yours", inline: false }
      )
      .setFooter({ text: "Keymania • Thank you 💜" })
      .setTimestamp();

    if (isDM) return msg.reply({ embeds: [resultEmbed] });

    try {
      await msg.author.send({ embeds: [resultEmbed] });
      msg.reply({ embeds: [
        new EmbedBuilder().setDescription("✅ **CHECK YOUR DMS!** 📩").setColor(0x2ECC71)
      ]});
    } catch {
      msg.reply({ embeds: [resultEmbed] });
    }
  }
}

client.on('messageCreate', handleCmd);
client.login(TOKEN).catch(e => console.log("❌ Login Error:", e.message));