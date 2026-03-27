const express = require('express');
const axios = require('axios');

const app = express();
// Дозволяє серверу читати JSON-дані з вхідних запитів
app.use(express.json());



// Наша база знань
const faqData = {
    "графік": "Ми працюємо з 9:00 до 18:00 з понеділка по п'ятницю.",
    "адреса": "Наш офіс знаходиться за адресою: м. Київ, вул. Хрещатик, 1.",
    "ціна": "Вартість наших послуг починається від 1000 грн."
};

// ==========================================
// ФУНКЦІЇ ДЛЯ ВІДПРАВКИ ПОВІДОМЛЕНЬ
// ==========================================

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
        console.error("Помилка відправки тексту:", error.response?.data || error.message);
    }
}

async function sendButtonMessage(toNumber, textMessage, buttonsList) {
    const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;
    
    // Формуємо масив кнопок (максимум 3)
    const buttons = buttonsList.slice(0, 3).map((title, index) => ({
        type: "reply",
        reply: {
            id: `btn_${index}`,
            title: title.substring(0, 20) // Обмеження Meta на 20 символів
        }
    }));

    const data = {
        messaging_product: "whatsapp",
        to: toNumber,
        type: "interactive",
        interactive: {
            type: "button",
            body: { text: textMessage },
            action: { buttons: buttons }
        }
    };

    try {
        await axios.post(url, data, {
            headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}` }
        });
    } catch (error) {
        console.error("Помилка відправки кнопок:", error.response?.data || error.message);
    }
}

async function sendDocument(toNumber, documentUrl, filename = "document.pdf") {
    const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;
    const data = {
        messaging_product: "whatsapp",
        to: toNumber,
        type: "document",
        document: {
            link: documentUrl,
            filename: filename
        }
    };

    try {
        await axios.post(url, data, {
            headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}` }
        });
    } catch (error) {
        console.error("Помилка відправки документа:", error.response?.data || error.message);
    }
}

// ==========================================
// ОБРОБКА ВЕБХУКІВ (МАРШРУТИ)
// ==========================================

// 1. GET-запит: Верифікація від Meta
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log("Вебхук успішно верифіковано!");
        // Meta вимагає повернути challenge як звичайний текст
        res.status(200).send(challenge);
    } else {
        res.status(403).send("Помилка верифікації");
    }
});

// 2. POST-запит: Отримання повідомлень від клієнтів
app.post('/webhook', async (req, res) => {
    const data = req.body;

    if (data.object === 'whatsapp_business_account') {
        // Використовуємо опціональний ланцюжок (?.) для безпечного читання JSON
        const message = data.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        
        if (message && message.type === 'text') {
            const senderPhone = message.from;
            const userMessage = message.text.body.toLowerCase();

            console.log(`Отримано повідомлення від ${senderPhone}: ${userMessage}`);

            const triggerWords = ["замовити", "людину", "менеджер", "підтвердити", "купити"];
            const hasTrigger = triggerWords.some(word => userMessage.includes(word));

            if (hasTrigger) {
                // Перенаправлення на менеджера
                await sendWhatsAppMessage(senderPhone, "Дякую! Ваше повідомлення передано адміністратору. Очікуйте на відповідь.");
                
                const adminAlert = `🚨 УВАГА! Запит від клієнта!\nНомер: +${senderPhone}\nТекст: ${userMessage}`;
                await sendWhatsAppMessage(ADMIN_PHONE, adminAlert);
            
            } else if (userMessage.includes("меню") || userMessage.includes("привіт")) {
                // Відправляємо кнопки
                await sendButtonMessage(senderPhone, "Вітаю! Чим я можу вам допомогти?", ["Прайс", "Контакти", "Менеджер"]);
            
            } else if (userMessage.includes("прайс")) {
                // Відправляємо PDF
                await sendDocument(
                    senderPhone, 
                    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", 
                    "Прайс_2026.pdf"
                );

            } else {
                // Звичайна перевірка FAQ
                let reply = "Я бот. Напишіть 'менеджер', щоб зв'язатися з людиною, або 'меню' для опцій.";
                for (const [key, value] of Object.entries(faqData)) {
                    if (userMessage.includes(key)) {
                        reply = value;
                        break;
                    }
                }
                await sendWhatsAppMessage(senderPhone, reply);
            }
        }
    }
    
    // Завжди відповідаємо 200 OK, щоб Meta не дублювала запити
    res.status(200).send("OK");
});

// Запуск сервера
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Сервер працює на порту ${PORT}`);
});
