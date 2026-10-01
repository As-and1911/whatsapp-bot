import express from 'express'
import dotenv from 'dotenv'
import { askGrok } from './groq.js'

dotenv.config()

const app = express()
app.use(express.json())

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080'
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'cardy-store-test'

app.get('/', (req, res) => {
    res.send('Bot WhatsApp en ligne ! 🚀')
})

// Envoie un message sortant via Evolution API
async function sendWhatsAppMessage(number, text) {
    const response = await fetch(
        `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                number: number,
                text: text
            })
        }
    )

    if (!response.ok) {
        const errText = await response.text()
        console.error('❌ Erreur envoi WhatsApp:', response.status, errText)
        throw new Error('SEND_FAILED')
    }

    return response.json()
}

// Réception des messages (format Evolution API / Baileys)
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body

        // Répond tout de suite à Evolution API pour ne pas bloquer le webhook
        res.sendStatus(200)

        if (body.event !== 'messages.upsert') {
            return
        }

        const data = body.data

        // Ignore les messages envoyés par le bot lui-même (écho)
        if (!data || data.key?.fromMe) {
            return
        }

        const remoteJid = data.key?.remoteJid
        const phoneNumber = remoteJid?.split('@')[0]
        const userMessage =
            data.message?.conversation ||
            data.message?.extendedTextMessage?.text

        if (!userMessage || !phoneNumber) {
            return
        }

        const reply = await askGrok(userMessage, phoneNumber)

        const transferKeywords = [
            'reviens vers toi',
            'équipe',
            'vérifier',
            'contacter',
            'gérant',
            'responsable'
        ]

        const needsTransfer = transferKeywords.some(keyword =>
            reply.toLowerCase().includes(keyword)
        )

        if (needsTransfer) {
            console.log(`🔔 TRANSFERT NECESSAIRE
                 Client : ${phoneNumber}
                 Question : ${userMessage}
                 -> Notifier le gérant sur WhatsApp`)
        }

        await sendWhatsAppMessage(remoteJid, reply)
        console.log('Voila la reponse envoyée :', reply)

    } catch (error) {
        console.error('Erreur webhook:', error.message)
        // res.sendStatus(200) déjà envoyé plus haut, on ne peut plus répondre ici
    }
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}`)
})
