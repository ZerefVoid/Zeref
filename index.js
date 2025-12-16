const { default: makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion, downloadContentFromMessage, jidDecode } = require("@adiwajshing/baileys");
const { state, saveState } = useSingleFileAuthState('./auth_info.json');
const fs = require("fs");
const path = require("path");

let tugasList = [];
let fileList = []; // { id, filename }

async function startBot() {
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ version, auth: state });

    sock.ev.on('creds.update', saveState);

    let botStatus = "OFF";
    let waitingFile = null; // ID file yang menunggu dikirim

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = (msg.message.conversation || '').toLowerCase();

        // Cuma respon grup
        if (!sender.endsWith('@g.us')) return;

        // --- AKTIVASI BOT ---
        if (botStatus === "OFF" && text === "halo zeref") {
            botStatus = "ON";
            await sock.sendMessage(sender, { text: "✅ Bot Zeref aktif di grup!" });
            return;
        }

        // --- NONAKTIFKAN BOT ---
        if (botStatus === "ON" && text === "zeref mode off") {
            botStatus = "OFF";
            await sock.sendMessage(sender, { text: "❌ Bot Zeref mati di grup!" });
            return;
        }

        if (botStatus === "OFF") return;

        // --- TERIMA FILE (jika dalam mode tunggu) ---
        if (waitingFile && msg.message.documentMessage) {
            const doc = msg.message.documentMessage;
            const filename = doc.fileName || waitingFile;
            const buffer = [];

            const stream = await downloadContentFromMessage(msg.message.documentMessage, 'buffer');
            const savePath = path.join("./files", filename);
            fs.mkdirSync("./files", { recursive: true });
            fs.writeFileSync(savePath, Buffer.from(stream));

            fileList.push({ id: waitingFile, filename });
            await sock.sendMessage(sender, { text: `✅ File untuk ID ${waitingFile} berhasil disimpan!` });
            waitingFile = null;
            return;
        }

        // --- MENU UTAMA ---
        if (text === "/menu" || text === "/help") {
            await sock.sendMessage(sender, { text:
`📋 Menu utama:
/tugas
/file
/help`});
            return;
        }

        // --- SUBMENU TUGAS ---
        if (text === "/tugas") {
            await sock.sendMessage(sender, { text:
`📌 Submenu Tugas:
/addtugas <nama> <tanggal>
/removetugas <nama> <tanggal>
/daftartugas`});
            return;
        }

        if (text.startsWith("/addtugas")) {
            let parts = text.split(" ");
            if(parts.length < 3) return sock.sendMessage(sender, { text: "❌ Format: /addtugas <nama> <tanggal>" });
            tugasList.push({ nama: parts[1], tanggal: parts[2] });
            await sock.sendMessage(sender, { text: `✅ Tugas ${parts[1]} disimpan.` });
            return;
        }

        if (text.startsWith("/removetugas")) {
            let parts = text.split(" ");
            if(parts.length < 3) return sock.sendMessage(sender, { text: "❌ Format: /removetugas <nama> <tanggal>" });
            let index = tugasList.findIndex(t => t.nama===parts[1] && t.tanggal===parts[2]);
            if(index !== -1) {
                tugasList.splice(index,1);
                await sock.sendMessage(sender, { text: `✅ Tugas ${parts[1]} dihapus.` });
            } else {
                await sock.sendMessage(sender, { text: "❌ Tugas tidak ditemukan." });
            }
            return;
        }

        if (text === "/daftartugas") {
            if(tugasList.length === 0) await sock.sendMessage(sender, { text: "📃 Belum ada tugas." });
            else {
                let list = tugasList.map(t=>`${t.nama} - ${t.tanggal}`).join("\n");
                await sock.sendMessage(sender, { text: `📃 Daftar tugas:\n${list}` });
            }
            return;
        }

        // --- SUBMENU FILE ---
        if (text === "/file") {
            await sock.sendMessage(sender, { text:
`📌 Submenu File:
/addfile <id>
/ambilfile <id>
/removefile <id>
/daftarfile`});
            return;
        }

        if (text.startsWith("/addfile")) {
            let parts = text.split(" ");
            if(parts.length < 2) return sock.sendMessage(sender, { text: "❌ Format: /addfile <id>" });
            waitingFile = parts[1];
            await sock.sendMessage(sender, { text: `📌 Kirim file untuk ID ${waitingFile}` });
            return;
        }

        if (text.startsWith("/ambilfile")) {
            let parts = text.split(" ");
            if(parts.length < 2) return sock.sendMessage(sender, { text: "❌ Format: /ambilfile <id>" });
            let f = fileList.find(f=>f.id===parts[1]);
            if(f){
                await sock.sendMessage(sender, { document: fs.readFileSync(path.join("./files", f.filename)), fileName: f.filename }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: "❌ File tidak ditemukan." });
            }
            return;
        }

        if (text.startsWith("/removefile")) {
            let parts = text.split(" ");
            if(parts.length < 2) return sock.sendMessage(sender, { text: "❌ Format: /removefile <id>" });
            let indexF = fileList.findIndex(f=>f.id===parts[1]);
            if(indexF !== -1) {
                let f = fileList[indexF];
                fs.unlinkSync(path.join("./files", f.filename));
                fileList.splice(indexF,1);
                await sock.sendMessage(sender, { text: `✅ File ID ${parts[1]} dihapus.` });
            } else {
                await sock.sendMessage(sender, { text: "❌ File tidak ditemukan." });
            }
            return;
        }

        if (text === "/daftarfile") {
            if(fileList.length === 0) await sock.sendMessage(sender, { text: "📃 Belum ada file." });
            else {
                let listF = fileList.map(f=>f.id).join("\n");
                await sock.sendMessage(sender, { text: `📃 Daftar file:\n${listF}` });
            }
            return;
        }

        // --- HELP ---
        if(text === "/help") {
            await sock.sendMessage(sender, { text:
`📌 **BANTUAN BOT ZEREF (GRUP)**

1️⃣ /tugas
- /addtugas <nama> <tanggal> → Menambahkan tugas baru
- /removetugas <nama> <tanggal> → Menghapus tugas
- /daftartugas → Menampilkan semua tugas

2️⃣ /file
- /addfile <id> → Menyimpan file dengan ID
- /ambilfile <id> → Mengambil file berdasarkan ID
- /removefile <id> → Menghapus file
- /daftarfile → Menampilkan semua file yang tersimpan

3️⃣ /help
- Menampilkan pesan ini`);
            return;
        }

    });
}

startBot();