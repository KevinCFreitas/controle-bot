const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
    authStrategy: new LocalAuth({
        dataPath: './session'
    })
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
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const nome = contact.pushname || 'amigo(a)';
    const lower = msg.body.toLowerCase();

    const sendTyping = async () => {
        await chat.sendStateTyping();
        await delay(1500);
    };

    if (['oi', 'olá', 'ola', 'menu', 'começar', 'inicio'].some(w => lower.includes(w))) {
        await sendTyping();
        await client.sendMessage(msg.from, `🧠 Olá! Eu sou o assistente virtual da *MindSync*.
Estou aqui para te ajudar a encontrar o suporte psicológico que você merece — com acolhimento, qualidade e um preço que cabe no seu bolso.

Posso te ajudar com:
1️⃣ Agendar uma sessão
2️⃣ Saber mais sobre nossos profissionais
3️⃣ Entender como funciona a MindSync

(Responda com o número ou a palavra-chave 😉)`);
    } else if (lower.includes('1') || lower.includes('agendar')) {
        await sendTyping();
        await client.sendMessage(msg.from, `📅 Perfeito! Vamos agendar sua sessão. Me responde com algumas informações rapidinho?

🗓 Qual dia e horário você prefere?
👤 Você já tem um(a) psicólogo(a) em mente ou quer que a gente recomende alguém pra você?
💬 Preferência por atendimento: [Texto | Vídeo | Áudio]`);
    } else if (lower.includes('2') || lower.includes('profissionais')) {
        await sendTyping();
        await client.sendMessage(msg.from, `📚 Temos uma equipe de psicólogos(as) experientes com pelo menos 10 anos de formado, empáticos(as) e com formações diversas.
Podemos indicar alguém com base na sua necessidade:

- Ansiedade e estresse
- Relacionamentos
- Autoconhecimento
- Luto
- Depressão
- Outros temas

Você gostaria de uma recomendação personalizada?`);
    } else if (lower.includes('3') || lower.includes('funciona')) {
        await sendTyping();
        await client.sendMessage(msg.from, `💡 A MindSync é uma plataforma de atendimento psicológico online com sessões a R$50,00 (cinquenta reais).
Todos os nossos profissionais são psicólogos(as) devidamente registrados(as) no CRP e selecionados(as) com muito cuidado.

Acreditamos que cuidar da mente é um direito, não um luxo.`);
    } else if (
        lower.includes('pix') || lower.includes('valor') ||
        lower.includes('pagar') || lower.includes('pagamento')
    ) {
        await sendTyping();
        await client.sendMessage(msg.from, `💰 Todas as sessões custam R$50,00 com duração média de 40 minutos.
O pagamento é feito via Pix e você só confirma sua sessão após o pagamento.

Quer saber como fazer o pagamento?`);
    } else if (
        lower.includes('sair') || lower.includes('desistir') || lower.includes('voltar depois')
    ) {
        await sendTyping();
        await client.sendMessage(msg.from, `❌ Sem problemas, você pode voltar quando quiser.
A sua jornada de cuidado com a mente é única, e estaremos aqui sempre que precisar 💙

Se quiser receber lembretes ou conteúdos gratuitos da MindSync, é só me avisar!`);
    } else if (
        lower.includes('ajuda') || lower.includes('confuso') || lower.includes('não sei')
    ) {
        await sendTyping();
        await client.sendMessage(msg.from, `🔁 Tudo bem não saber por onde começar. Eu posso te guiar.

Que tal responder:
👉 "Quero ajuda pra escolher um psicólogo"
👉 "Quero entender como funciona"
👉 "Quero agendar minha primeira sessão"`);
    } else if (
        lower.includes('áudio') || lower.includes('vídeo') || lower.includes('texto') ||
        lower.includes('dia') || lower.includes('horário')
    ) {
        await sendTyping();
        await client.sendMessage(msg.from, `Ótimo! Estamos quase lá. Agora me diga seu nome completo e um número de WhatsApp para confirmação.`);
    } else if (msg.body.length > 10 && msg.body.includes(' ')) {
        await sendTyping();
        await client.sendMessage(msg.from, `Tudo certo, ${nome}! Em breve, nosso time vai te mandar a confirmação da sessão pelo WhatsApp.

Enquanto isso, qualquer dúvida é só me chamar 💙`);
    }
});