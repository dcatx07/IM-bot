const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json()); // Дозволяє читати вхідні дані у форматі JSON

// Змінні оточення з Render
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'my_super_secret_token_123';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '';

// Функція для відправки повідомлення назад
async function sendWhatsAppMessage(toNumber, textMessage) {
    const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;
    const data = {
        messaging_product: "whatsapp",
        to: toNumber,
        type: "text",
        text: { body: textMessage }
    };
    const headers = {
        "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
    };
    
    try {
        await axios.post(url, data, { headers });
    } catch (error) {
        console.error("Помилка відправки:", error.response?.data || error.message);
    }
}

// 1. GET-запит: Необхідний для підключення вебхука в кабінеті Meta
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.status(403).send("Помилка верифікації");
    }
});

// 2. POST-запит: Тут ми отримуємо повідомлення від клієнта
app.post('/webhook', async (req, res) => {
    const data = req.body;

    // Перевіряємо, чи це повідомлення з WhatsApp
    if (data.object === 'whatsapp_business_account') {
        // Безпечно дістаємо текст повідомлення з JSON
        const message = data.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        
        // Переконуємося, що це саме текстове повідомлення (а не картинка чи статус "прочитано")
        if (message && message.type === 'text') {
            const senderPhone = message.from; // Номер клієнта
            const userMessage = message.text.body; // Оригінальний текст клієнта

            console.log(`Отримано текст: "${userMessage}" від ${senderPhone}. Відправляю назад...`);

            // Формуємо відповідь і відправляємо її назад
            const replyText = `Ви написали: ${userMessage}`;
            await sendWhatsAppMessage(senderPhone, replyText);
        }
    }
    
    // Обов'язково повертаємо статус 200, щоб Meta зрозуміла, що ми прийняли запит
    res.status(200).send("OK");
});

// Запуск сервера
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Echo-бот працює на порту ${PORT}`);
});
