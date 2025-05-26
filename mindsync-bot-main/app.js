const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
    executablePath: '/usr/bin/google-chrome'
  }
});


client.on('qr', async qr => {
    const qrImageUrl = await QRCode.toDataURL(qr);
    console.log('⚠️ Escaneie este QR Code com o WhatsApp:');
    console.log(qrImageUrl);
});

client.on('ready', () => {
    console.log('✅ WhatsApp conectado com sucesso!');
});

client.initialize();

const delay = ms => new Promise(res => setTimeout(res, ms));

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
        await msg.reply(`👋 Olá! Seja bem-vindo(a) à *MindSync* 🧠✨

Aqui, conectamos você ao cuidado psicológico com empatia, acolhimento e preço acessível. 💙

Antes de continuarmos, me diz uma coisa:
Você está aqui como:

1️⃣ Paciente
2️⃣ Psicólogo(a)`);
    } else if (lower.includes('1')) {
        await sendTyping();
        await msg.reply(`🧠 Formulário para Pacientes:
Por favor, preencha seus dados aqui:
👉 https://forms.gle/hEt3uNHX2ay7j9qd8`);
    } else if (lower.includes('2')) {
        await sendTyping();
        await msg.reply(`📋 Cadastro para Psicólogos:
Preencha o formulário com seus dados profissionais:
👉 https://forms.gle/CgChZmvAm2aTeDEv7`);
    }
});
