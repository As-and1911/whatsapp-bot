import Groq from 'groq-sdk'
import storeConfig from '../config/cardy-store.config.js'
import { retrieveContext } from './rag.js'

const conversations = {}
const MAX_HISTORY = 10 // nombre de messages (user+assistant) gardés par client

function buildSystemPrompt(context) {
    return `Tu t'appelles ${storeConfig.botName}. Tu es l'assistante de ${storeConfig.storeName}, une ${storeConfig.storeType} à ${storeConfig.location}.

INFOS PERTINENTES POUR CETTE QUESTION :
${context || "Aucune info spécifique trouvée pour cette question — reste générale et propose de vérifier avec l'équipe si besoin."}

Contact : ${storeConfig.contact}
Localisation : ${storeConfig.location}

RÈGLES :
${storeConfig.tone}
Si on te demande qui tu es : "Je suis ${storeConfig.botName} de ${storeConfig.storeName} 😊"`
}

export async function askGrok(userMessage, phoneNumber = 'default') {

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

    if (!conversations[phoneNumber]) {
        conversations[phoneNumber] = []
    }

    conversations[phoneNumber].push({
        role: 'user',
        content: userMessage
    })

    if (conversations[phoneNumber].length > MAX_HISTORY) {
        conversations[phoneNumber] = conversations[phoneNumber].slice(-MAX_HISTORY)
    }

    try {
        // RAG : récupère les passages pertinents pour la question posée
        const context = await retrieveContext(storeConfig.knowledgeBaseId, userMessage)

        const response = await groq.chat.completions.create({
            model: 'qwen/qwen3.8-27b',
            reasoning_effort: 'none',
            messages: [
                {
                    role: 'system',
                    content: buildSystemPrompt(context)
                },
                ...conversations[phoneNumber]
            ]
        })

        const rawReply = response.choices[0].message.content
        const reply = rawReply.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

        conversations[phoneNumber].push({
            role: 'assistant',
            content: reply
        })

        if (conversations[phoneNumber].length > MAX_HISTORY) {
            conversations[phoneNumber] = conversations[phoneNumber].slice(-MAX_HISTORY)
        }

        return reply

    } catch (error) {
        console.log('Détails erreur Grok', JSON.stringify(error))
        if (error.status === 429) {
            console.error('⚠️ Quota Grok atteint')
            throw new Error('RATE_LIMIT')
        }

        console.error('❌ Erreur Grok :', error.message)
        throw error
    }
}
