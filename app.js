import os
import requests
from flask import Flask, request, jsonify

app = Flask(__name__)

VERIFY_TOKEN = os.environ.get('VERIFY_TOKEN', 'my_super_secret_token_123')
WHATSAPP_TOKEN = os.environ.get('WHATSAPP_TOKEN', '')
PHONE_NUMBER_ID = os.environ.get('PHONE_NUMBER_ID', '')

# ДОДАЄМО: Номер адміністратора (змінна оточення або просто вписати сюди)
# Номер має бути у міжнародному форматі без плюса (наприклад, 380501234567)
ADMIN_PHONE = os.environ.get('ADMIN_PHONE', '380000000000') 

def send_whatsapp_message(to_number, text_message):
    # ... (ця функція залишається без змін з попереднього кроку) ...
    url = f"https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"body": text_message}
    }
    requests.post(url, headers=headers, json=payload)

@app.route('/webhook', methods=['GET', 'POST'])
def webhook():
    # ... (GET запит для верифікації залишається без змін) ...

    if request.method == 'POST':
        data = request.json
        if data.get('object') == 'whatsapp_business_account':
            try:
                entry = data['entry'][0]
                changes = entry['changes'][0]
                value = changes['value']
                
                if 'messages' in value:
                    message = value['messages'][0]
                    sender_phone = message['from']  # Номер клієнта
                    user_message = message['text']['body'].lower() # Текст клієнта

                    # ==========================================
                    # НОВА ЛОГІКА: Перевірка на потребу зв'язку з менеджером
                    # ==========================================
                    trigger_words = ["замовити", "людину", "менеджер", "підтвердити", "купити"]
                    
                    # Перевіряємо, чи є в тексті хоча б одне слово-тригер
                    if any(word in user_message for word in trigger_words):
                        
                        # 1. Заспокоюємо клієнта
                        send_whatsapp_message(sender_phone, "Дякую! Ваше повідомлення передано адміністратору. Очікуйте на відповідь.")
                        
                        # 2. Формуємо текст для адміна (додаємо номер клієнта, щоб знати, кому відповідати)
                        admin_alert = f"🚨 УВАГА! Запит від клієнта!\nНомер: +{sender_phone}\nТекст: {user_message}"
                        
                        # 3. Відправляємо адміну
                        send_whatsapp_message(ADMIN_PHONE, admin_alert)

                    else:
                        # Звичайна логіка FAQ (якщо тригерних слів немає)
                        faq_data = {"графік": "з 9 до 18", "ціна": "від 1000 грн"}
                        reply = "Я бот. Напишіть 'менеджер', щоб зв'язатися з людиною."
                        for key in faq_data:
                            if key in user_message:
                                reply = faq_data[key]
                                break
                        send_whatsapp_message(sender_phone, reply)

            except KeyError:
                pass

        return jsonify({"status": "ok"}), 200

if __name__ == '__main__':
    app.run(port=5000)
