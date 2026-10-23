const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

// ─── CONFIG ──────────────────────────────────────
const CONFIG = {
  prefix: '!',
  autoRefillAmount: 5,      // Auto-add this many accounts when service runs out
  token: process.env.DISCORD_BOT_TOKEN || '',
  adminIds: ['PUT_YOUR_DISCORD_ID_HERE'] // Your Discord ID
};

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
  return loadJSON('./stock.json', {}); // { ServiceName: [accounts] }
}

function ensureServiceAndRefill(serviceName) {
  let stock = getStock();
  
  // Create service if missing
  if (!stock[serviceName] || !Array.isArray(stock[serviceName])) {
    stock[serviceName] = [];
  }

  // ✅ AUTO-REFILL WHEN EMPTY
  if (stock[serviceName].length === 0) {
    // Generate placeholder accounts — customize format to match yours!
    for (let i = 0; i < CONFIG.autoRefillAmount; i++) {
      const genEmail = `auto${Math.random().toString(36).substring(2, 10)}@example.com`;
      const genPass = `Pass${Math.random().toString(36).substring(2, 8)}!`;
      stock[serviceName].push(`${genEmail}:${genPass}`);
    }
    saveJSON('./stock.json', stock);
    console.log(`✅ Auto-refilled "${serviceName}" with ${CONFIG.autoRefillAmount} accounts`);
  }

  return stock;
}

function takeAccount(serviceName) {
  let stock = ensureServiceAndRefill(serviceName);
  const account = stock[serviceName].shift(); // Take first
  saveJSON('./stock.json', stock);
  return account;
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

    const entries = Object.entries(stock);
    if (entries.length === 0) {
      embed.addFields({ name: 'No services yet', value: 'Use `!restock ServiceName` to add stock' });
    } else {
      for (const [name, accs] of entries) {
        embed.addFields({
          name: name,
          value: `${accs.length} in stock`,
          inline: true
        });
      }
    }
    message.reply({ embeds: [embed] });
    return;
  }

  // ─── !gen ServiceName ─ AUTO-REFILL ────────────
  if (cmd === 'gen') {
    const serviceName = args[0];
    if (!serviceName) {
      return message.reply('❌ Usage: `!gen ServiceName`');
    }

    try {
      const account = takeAccount(serviceName);
      await message.author.send(`🔑 **${serviceName}**\n\`${account}\``);
      message.reply(`✅ Sent **${serviceName}** account in DMs!`);
    } catch (err) {
      console.error(err);
      message.reply('❌ Something went wrong — try again.');
    }
    return;
  }

  // ─── !stock ────────────────────────────────────
  if (cmd === 'stock') {
    const stock = getStock();
    let reply = '📦 **All Stock Levels**\n\n';
    const entries = Object.entries(stock);
    if (entries.length === 0) {
      reply += 'No stock found.';
    } else {
      for (const [name, accs] of entries) {
        reply += `**${name}**: ${accs.length} remaining\n`;
      }
    }
    message.reply(reply);
    return;
  }

  // ─── !restock ServiceName ─────────────────────
  if (cmd === 'restock') {
    if (!CONFIG.adminIds.includes(message.author.id)) {
      return message.reply('❌ Only admins can restock.');
    }
    const serviceName = args.shift();
    if (!serviceName) {
      return message.reply('❌ Usage: `!restock ServiceName` then paste accounts below');
    }
    // Everything after the command = accounts (one per line)
    const restockText = args.join(' ');
    const accounts = restockText.split('\n').filter(l => l.trim() && l.includes(':'));
    
    if (accounts.length === 0) {
      return message.reply('❌ No valid accounts found — format: `email:password` one per line');
    }

    let stock = getStock();
    if (!stock[serviceName]) stock[serviceName] = [];
    stock[serviceName].push(...accounts);
    saveJSON('./stock.json', stock);
    message.reply(`✅ Added **${accounts.length}** accounts to **${serviceName}** — total: ${stock[serviceName].length}`);
    return;
  }

  // ─── !clearstock ServiceName ──────────────────
  if (cmd === 'clearstock') {
    if (!CONFIG.adminIds.includes(message.author.id)) {
      return message.reply('❌ Only admins can clear stock.');
    }
    const serviceName = args[0];
    if (!serviceName) {
      return message.reply('❌ Usage: `!clearstock ServiceName`');
    }
    let stock = getStock();
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
  console.error('❌ DISCORD_BOT_TOKEN not set in environment variables!');
  process.exit(1);
}
client.login(CONFIG.token);
