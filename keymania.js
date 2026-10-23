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
const cooldowns = new Map();

function isOnCooldown(userId) {
  if (!cooldowns.has(userId)) return false;
  return Date.now() - cooldowns.get(userId) < CONFIG.cooldownMs;
}

function getRemainingTime(userId) {
  const rem = CONFIG.cooldownMs - (Date.now() - cooldowns.get(userId));
  return `${Math.floor(rem / 3600000)}h ${Math.floor((rem % 3600000) / 60000)}m`;
}

function setCooldown(userId) {
  cooldowns.set(userId, Date.now());
}

// ─── FILE HELPERS ───────────────────────────────
function loadJSON(path, fallback = {}) {
  try { return fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : fallback; }
  catch { return fallback; }
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

// ─── STOCK ──────────────────────────────────────
function getStock() { return loadJSON('./stock.json', {}); }

function takeAccount(serviceName) {
  const stock = getStock();
  if (!stock[serviceName]?.length) return null;
  const acc = stock[serviceName].shift();
  saveJSON('./stock.json', stock);
  return acc;
}

function addAccounts(serviceName, list) {
  const stock = getStock();
  if (!Array.isArray(stock[serviceName])) stock[serviceName] = [];
  stock[serviceName].push(...list);
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
  if (message.author.bot || !message.content.startsWith(CONFIG.prefix)) return;

  const args = message.content.slice(CONFIG.prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // ─── !genmenu ──────────────────────────────────
  if (cmd === 'genmenu') {
    const stock = getStock();
    const embed = new EmbedBuilder()
      .setTitle('🔑 Keymania • Premium Generator')
      .setDescription('Available services & stock levels')
      .setColor('#9b59b6');

    ['paypal', 'fortnite', 'aboodi', 'valorant'].forEach(svc => {
      const n = stock[svc]?.length || 0;
      embed.addFields({ name: svc, value: n > 0 ? `${n} in stock` : 'undefined in stock', inline: true });
    });
    return message.reply({ embeds: [embed] });
  }

  // ─── !gen ServiceName ─────────────────────────
  if (cmd === 'gen') {
    const serviceName = args[0]?.toLowerCase();
    if (!serviceName) return message.reply('❌ Usage: `!gen fortnite`');

    // Cooldown check
    const hasRole = message.guild?.members.cache.get(message.author.id)?.roles.cache.has(CONFIG.cooldownRoleId);
    if (hasRole && isOnCooldown(message.author.id)) {
      return message.reply(`⏳ You're on cooldown! Wait **${getRemainingTime(message.author.id)}** before generating again.`);
    }

    const account = takeAccount(serviceName);
    if (!account) {
      return message.reply(
        '📦 **SOLD OUT**\n' +
        'No stock available right now.\n' +
        'Please ping @gen stock access to restock!'
      );
    }

    if (hasRole) setCooldown(message.author.id);

    // ─── EXACT STYLE FROM YOUR SCREENSHOT ───────
    const claimEmbed = new EmbedBuilder()
      .setTitle('✨ YOUR PREMIUM ACCOUNT ✨')
      .setColor('#9b59b6')
      .addFields(
        { name: '', value: '✅ **CLAIMED — YOURS ALONE**', inline: false },
        { name: 'Service', value: serviceName, inline: false },
        { name: 'Credentials', value: `\`${account}\``, inline: false },
        { name: '🔒 Security', value: 
          '• This account is **PERMANENTLY** removed from stock\n' +
          '• No one else can ever claim it\n' +
          '• Change password immediately\n' +
          '• Not resellable',
          inline: false
        }
      )
      .setFooter({ text: 'Keymania • Yours exclusively 💜 • Today at ' + new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}) });

    try {
      await message.author.send({ embeds: [claimEmbed] });
      message.reply(`✅ Your **${serviceName}** account has been sent to your DMs!`);
    } catch {
      message.reply({ embeds: [claimEmbed] });
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
      return message.reply('❌ Usage: `!restock fortnite`\\n`email:password`');
    }
    const accounts = message.content.split('\n').slice(1)
      .map(l => l.trim()).filter(l => l && l.includes(':'));
    if (!accounts.length) {
      return message.reply('❌ No valid accounts found — use format: `email:password` one per line');
    }
    const total = addAccounts(serviceName, accounts);
    return message.reply(`✅ Added **${accounts.length}** accounts to **${serviceName}** — total: ${total}`);
  }

  // ─── !clearstock ──────────────────────────────
  if (cmd === 'clearstock') {
    if (!CONFIG.adminIds.includes(message.author.id)) {
      return message.reply('❌ Only admins can clear stock.');
    }
    const serviceName = args[0]?.toLowerCase();
    if (!serviceName) return message.reply('❌ Usage: `!clearstock fortnite`');
    const stock = getStock();
    stock[serviceName] = [];
    saveJSON('./stock.json', stock);
    return message.reply(`✅ Cleared all stock for **${serviceName}**`);
  }
});

client.on('ready', () => console.log(`✅ Logged in as ${client.user.tag}`));

if (!CONFIG.token) { console.error('❌ No token set!'); process.exit(1); }
client.login(CONFIG.token);
