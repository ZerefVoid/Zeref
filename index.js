const { default: makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion } = require("@adiwajshing/baileys");
const { state, saveState } = useSingleFileAuthState('./auth_info.json');

async function startBot() {
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ version, auth: state });

    sock.ev.on('creds.update', saveState);

    let botStatus = "OFF";

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || '';

        // AKTIVASI BOT
        if (botStatus === "OFF" && text.toLowerCase() === "halo zeref") {
            botStatus = "ON";
            await sock.sendMessage(sender, { text: "✅ Bot Zeref aktif!" });
            return;
        }

        // NONAKTIFKAN BOT
        if (botStatus === "ON" && text.toLowerCase() === "zeref mode off") {
            botStatus = "OFF";
            await sock.sendMessage(sender, { text: "❌ Bot Zeref mati!" });
            return;
        }

        // COMMAND /menu
        if (botStatus === "ON" && text.toLowerCase() === "/menu") {
            await sock.sendMessage(sender, { text: "📋 Daftar command:\n/menu\n/tugas\n/file\n/status\n/cari\n/detail" });
        }
    });
}

startBot();
