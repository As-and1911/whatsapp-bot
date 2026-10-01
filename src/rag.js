import { pipeline } from '@xenova/transformers'
import { ChromaClient } from 'chromadb'

const chroma = new ChromaClient({ path: 'http://localhost:8000' })

let embedder = null
async function getEmbedder() {
    if (!embedder) {
        // Modèle d'embedding local, léger (~90 Mo), gratuit, tourne directement dans Node
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    }
    return embedder
}

async function embedText(text) {
    const model = await getEmbedder()
    const output = await model(text, { pooling: 'mean', normalize: true })
    return Array.from(output.data)
}

// Découpe un texte en morceaux (chunks) par paragraphe (séparés par une ligne vide)
function chunkText(text) {
    return text
        .split(/\n\s*\n/)
        .map(chunk => chunk.trim())
        .filter(chunk => chunk.length > 0)
}

// Indexe un document texte dans la base vectorielle, pour une boutique donnée
export async function ingestDocument(knowledgeBaseId, documentId, text) {
    const collection = await chroma.getOrCreateCollection({ name: knowledgeBaseId })
    const chunks = chunkText(text)

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const embedding = await embedText(chunk)
        await collection.upsert({
            ids: [`${documentId}-${i}`],
            embeddings: [embedding],
            documents: [chunk]
        })
    }

    console.log(`✅ ${chunks.length} chunks indexés pour "${documentId}" dans "${knowledgeBaseId}"`)
}

// Récupère les passages les plus pertinents pour une question donnée
export async function retrieveContext(knowledgeBaseId, query, topK = 3) {
    const collection = await chroma.getOrCreateCollection({ name: knowledgeBaseId })
    const queryEmbedding = await embedText(query)

    const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK
    })

    const documents = results.documents?.[0] || []
    return documents.join('\n\n')
}
