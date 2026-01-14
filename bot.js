import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events
} from "discord.js";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = "!";
const sessions = new Map();

/* ======================
   Helpers
====================== */
async function fetchScripts(query) {
  const r = await fetch(
    `${process.env.SITE_API}/api/search?q=${encodeURIComponent(query)}`
  );
  const d = await r.json();
  return d.results || [];
}

function embedFor(script, index, total) {
  const e = new EmbedBuilder()
    .setColor("#22c55e")
    .setTitle(script.title_ar || script.title || "بدون عنوان")
    .setDescription(script.description_ar || "لا يوجد وصف")
    .setFooter({
      text: `📄 ${index + 1} / ${total}   👁️ ${script.views || 0}   ${
        script.key ? "🔑 بمفتاح" : "✅ بدون مفتاح"
      }`
    });

  if (script.image) e.setImage(script.image);
  return e;
}

function buttons(index, total) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("prev")
      .setLabel("⬅️ السابق")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(index === 0),

    new ButtonBuilder()
      .setCustomId("copy")
      .setLabel("📋 نسخ السكربت")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("next")
      .setLabel("➡️ التالي")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(index === total - 1)
  );
}

/* ======================
   Message Commands
====================== */
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(1).trim().split(" ");
  const cmd = args.shift();

  if (cmd === "بحث") {
    const q = args.join(" ");
    if (!q) return msg.reply("❌ اكتب اسم السكربت بعد الأمر");

    const scripts = await fetchScripts(q);
    if (!scripts.length) return msg.reply("❌ لا توجد نتائج");

    const index = 0;
    const sent = await msg.channel.send({
      embeds: [embedFor(scripts[index], index, scripts.length)],
      components: [buttons(index, scripts.length)]
    });

    sessions.set(msg.author.id, {
      scripts,
      index,
      messageId: sent.id
    });
  }

  if (cmd === "مساعدة") {
    msg.reply(
`📌 **أوامر البوت**
!بحث <اسم> — البحث عن سكربتات Roblox
!مساعدة — عرض هذه الرسالة`
    );
  }
});

/* ======================
   Buttons
====================== */
client.on(Events.InteractionCreate, async i => {
  if (!i.isButton()) return;

  const s = sessions.get(i.user.id);
  if (!s || i.message.id !== s.messageId)
    return i.reply({ content: "❌ هذا التصفح ليس لك", ephemeral: true });

  if (i.customId === "prev") s.index--;
  if (i.customId === "next") s.index++;

  if (i.customId === "copy") {
    try {
      await i.user.send(
        `📋 **السكربت:**\nloadstring(game:HttpGet("${s.scripts[s.index].rawScript}"))()`
      );
      return i.reply({ content: "✅ تم إرسال السكربت بالخاص", ephemeral: true });
    } catch {
      return i.reply({ content: "❌ افتح الخاص أولاً", ephemeral: true });
    }
  }

  await i.update({
    embeds: [embedFor(s.scripts[s.index], s.index, s.scripts.length)],
    components: [buttons(s.index, s.scripts.length)]
  });
});

client.login(process.env.DISCORD_TOKEN);
