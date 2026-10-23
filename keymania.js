const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

// ─── CONFIG ──────────────────────────────────────
const CONFIG = {
  prefix: '!',
  token: process.env.DISCORD_BOT_TOKEN || '',
  adminIds: ['711334755328720947'], // Your Discord ID
  cooldownRoleId: '1561407866584178748',
  cooldownMs: 3 * 60 * 60 * 1000 // 3 hours
};

// ─── COOLDOWN TRACKER ────────────────────────────
const cooldowns = new Map(); // userId → timestamp

function isOnCooldown(userId) {
  if (!cooldowns.has(userId)) return false;
  const lastUsed = cooldowns.get(userId);
  return Date.now() - lastUsed < CONFIG.cooldownMs;
}

function getRemainingTime(userId) {
  const lastUsed = cooldowns.get(userId);
  const remaining = CONFIG.cooldownMs - (Date.now() - lastUsed);
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

function setCooldown(userId) {
  cooldowns.set(userId, Date.now());
}

// ─── FILE HELPERS ───────────────────────────────
function loadJSON(path, fallback = {}) {
  try {
    if (!fs.existsSync(path)) return fallback;
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

// ─── STOCK MANAGEMENT ────────────────────────────
function getStock() {
  return loadJSON('./stock.json', {});
}

function takeAccount(serviceName) {
  const stock = getStock();
  if (!stock[serviceName] || !Array.isArray(stock[serviceName]) || stock[serviceName].length === 0) {
    return null;
  }
  const account = stock[serviceName].shift();
  saveJSON('./stock.json', stock);
  return account;
}

function addAccounts(serviceName, accountList) {
  const stock = getStock();
  if (!stock[serviceName] || !Array.isArray(stock[serviceName])) {
    stock[serviceName] = [];
  }
  stock[serviceName].push(...accountList);
  saveJSON('./stock.json', stock);
  return stock[serviceName].length;
}

// ─── INIT BOT ────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// ─── COMMANDS ────────────────────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(CONFIG.prefix)) return;

  const args = message.content.slice(CONFIG.prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // ─── !genmenu ──────────────────────────────────
  if (cmd === 'genmenu') {
    const stock = getStock();
    const embed = new EmbedBuilder()
      .setTitle('🔑 Keymania • Premium Generator')
      .setDescription('Available services & stock levels')
      .setColor('#9b59b6');

    const services = ['paypal', 'fortnite', 'aboodi', 'valorant'];
    for (const svc of services) {
      const count = stock[svc]?.length || 0;
      embed.addFields({
        name: svc,
        value: count > 0 ? `${count} in stock` : 'undefined in stock',
        inline: true
      });
    }
    message.reply({ embeds: [embed] });
    return;
  }

  // ─── !gen ServiceName ─────────────────────────
  if (cmd === 'gen') {
    const serviceName = args[0]?.toLowerCase();
    if (!serviceName) {
      return message.reply('❌ Usage: `!gen ServiceName`\nExamples: `!gen fortnite` | `!gen paypal`');
    }

    // Check if user has the cooldown role
    const member = message.guild?.members.cache.get(message.author.id);
    const hasCooldownRole = member?.roles.cache.has(CONFIG.cooldownRoleId);

    if (hasCooldownRole && isOnCooldown(message.author.id)) {
      return message.reply(`⏳ You're on cooldown! Please wait **${getRemainingTime(message.author.id)}** before generating again.`);
    }

    const account = takeAccount(serviceName);
    
    if (!account) {
      return message.reply(
        '📦 **SOLD OUT**\n' +
        'No stock available right now.\n' +
        'Please ping @gen stock access to restock!'
      );
    }

    // Set cooldown ONLY if they have the role
    if (hasCooldownRole) {
      setCooldown(message.author.id);
    }

    try {
      await message.author.send(`🔑 **${serviceName}**\n\`${account}\``);
      message.reply(`✅ Sent **${serviceName}** account in DMs!`);
    } catch {
      message.reply('❌ Could not DM you — check privacy settings.');
    }
    return;
  }

  // ─── !restock ──────────────────────────────────
  if (cmd === 'restock') {
    if (!CONFIG.adminIds.includes(message.author.id)) {
      return message.reply('❌ Only admins can restock.');
    }
    const serviceName = args.shift()?.toLowerCase();
    if (!serviceName) {
      return message.reply('❌ Usage: `!restock fortnite`\nThen paste accounts below, one per line');
    }
    const restockText = message.content.split('\n').slice(1).join('\n');
    const accounts = restockText.split('\n')
      .map(line => line.trim())
      .filter(line => line && line.includes(':'));
    
    if (accounts.length === 0) {
      return message.reply('❌ No valid accounts found — format: `email:password` one per line\n\nExample:\n`!restock fortnite`\n`email@gmail.com:password`');
    }

    const total = addAccounts(serviceName, accounts);
    message.reply(`✅ Added **${accounts.length}** accounts to **${serviceName}** — total: ${total}`);
    return;
  }

  // ─── !clearstock ──────────────────────────────
  if (cmd === 'clearstock') {
    if (!CONFIG.adminIds.includes(message.author.id)) {
      return message.reply('❌ Only admins can clear stock.');
    }
    const serviceName = args[0]?.toLowerCase();
    if (!serviceName) {
      return message.reply('❌ Usage: `!clearstock fortnite`');
    }
    const stock = getStock();
    stock[serviceName] = [];
    saveJSON('./stock.json', stock);
    message.reply(`✅ Cleared all stock for **${serviceName}**`);
    return;
  }
});

// ─── READY ───────────────────────────────────────
client.on('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ─── LOGIN ───────────────────────────────────────
if (!CONFIG.token) {
  console.error('❌ DISCORD_BOT_TOKEN not set!');
  process.exit(1);
}
client.login(CONFIG.token);
