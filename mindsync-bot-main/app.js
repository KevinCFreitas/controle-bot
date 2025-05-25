
const express = require('express');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
const PORT = process.env.PORT || 8000;

let qrCodeDataURL = '';

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', async qr => {
    qrCodeDataURL = await QRCode.toDataURL(qr);
    console.log('QR Code atualizado. Acesse /qr para escanear.');
});

client.on('ready', () => {
    console.log('WhatsApp conectado com sucesso!');
});

client.on('message', async msg => {
    const lower = msg.body.toLowerCase();
    const chat = await msg.getChat();
    const delay = ms => new Promise(res => setTimeout(res, ms));
    const sendTyping = async () => {
        await chat.sendStateTyping();
        await delay(1500);
    };

    if (['oi', 'olá', 'ola', 'menu', 'começar', 'inicio'].some(w => lower.includes(w))) {
        await sendTyping();
        await msg.reply(`Olá! Seja bem-vindo(a) à MindSync

Aqui, conectamos você ao cuidado psicológico com empatia, acolhimento e preço acessível.

Antes de continuarmos, me diz uma coisa:
Você está aqui como:

1️⃣ Paciente
2️⃣ Psicólogo(a)`);
    } else if (lower.includes('1')) {
        await sendTyping();
        await msg.reply(`Formulário de paciente:
Acesse: https://forms.gle/hEt3uNHX2ay7j9qd8`);
    } else if (lower.includes('2')) {
        await sendTyping();
        await msg.reply(`Cadastro para psicólogos:
Acesse: https://forms.gle/CgChZmvAm2aTeDEv7`);
    }
});

client.initialize();

app.get('/qr', (req, res) => {
    if (!qrCodeDataURL) return res.send('QR Code ainda não gerado.');
    res.send(`<img src="${qrCodeDataURL}" style="width:300px;height:300px;" />`);
});

app.listen(PORT, () => {
    console.log(`Servidor web ouvindo na porta ${PORT}. Acesse /qr para ver o QR Code.`);
});
