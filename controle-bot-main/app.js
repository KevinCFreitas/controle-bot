const { Client, LocalAuth } = require('whatsapp-web.js');
const { responder } = require('./services/responder');
const { agendarMensagens } = require('./services/schedule');
const fs = require('fs');

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './wwebjs_auth' }),
    puppeteer: false
});

client.on('qr', (qr) => console.log('QR RECEIVED', qr));
client.on('ready', () => {
    console.log('Bot iniciado com sucesso!');
    agendarMensagens(client);
});

client.on('message', async msg => responder(client, msg));

client.initialize();
