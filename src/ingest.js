import fs from 'fs'
import path from 'path'
import { ingestDocument } from './rag.js'
import storeConfig from '../config/cardy-store.config.js'

const knowledgeDir = path.join('knowledge', storeConfig.knowledgeBaseId)
const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.md'))

for (const file of files) {
    const content = fs.readFileSync(path.join(knowledgeDir, file), 'utf-8')
    await ingestDocument(storeConfig.knowledgeBaseId, file, content)
}

console.log('🎉 Ingestion terminée pour', storeConfig.storeName)
