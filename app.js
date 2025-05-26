const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
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
        await msg.reply(`Perfeito! 💙

Pra gente te atender da melhor forma, só precisamos que você preencha esse formulário com algumas informações básicas:🧠 Formulário para Pacientes:
Por favor, preencha seus dados aqui:
👉 https://forms.gle/WkTUb4GG6GLbA5HJ7Perfeito! 💙

Pra gente te atender da melhor forma, só precisamos que você preencha esse formulário com algumas informações básicas:

📄https://forms.gle/WkTUb4GG6GLbA5HJ7

Depois de preencher, nossa equipe entrará em contato com você pelo WhatsApp para te apresentar os horários disponíveis e tirar dúvidas, beleza?

⚠ Caso tenha qualquer dúvida durante o processo, é só digitar *"ajuda"* aqui mesmo.
Depois de preencher, nossa equipe entrará em contato com você pelo WhatsApp para te apresentar os horários disponíveis e tirar dúvidas, beleza?

⚠ Caso tenha qualquer dúvida durante o processo, é só digitar *"ajuda"* aqui mesmo.`);

    } else if (lower.includes('2')) {
        await sendTyping();
        await msg.reply(`📋 Maravilha! 👩‍⚕👨‍⚕Se você deseja fazer parte da equipe da MindSync, precisamos que preencha esse formulário com seus dados e documentos:
👉 https://forms.gle/ea9ZxwVjqqiqGPhZ9
Assim que recebermos suas informações, entraremos em contato com os próximos passos. 🧾💬

⚠ Em caso de dúvidas, é só digitar *"ajuda"* aqui no chat.`);
    }
});
