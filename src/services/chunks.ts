import {OpenAI} from './openai';
import {Document, DocumentChunk} from '../models/models';
import {v4} from 'uuid';
import {Tiktoken, getEncoding} from "js-tiktoken";
import {ChatGPTEnablerSettings} from "../interfaces/ISettings";

export class Chunks {
	private CHUNK_SIZE = 200;
	private MIN_CHUNK_SIZE_CHARS = 350;
	private MIN_CHUNK_LENGTH_TO_EMBED = 5;
	private EMBEDDINGS_BATCH_SIZE = 128; // This should be set from environment variable
	private MAX_NUM_CHUNKS = 10000;
	private openai: OpenAI;
	private tokenizer: Tiktoken;

	constructor(settings: ChatGPTEnablerSettings, openai: OpenAI) {
		this.openai = openai;
		this.tokenizer = getEncoding("cl100k_base");
	}

	public async getDocumentChunks(documents: Document[], chunkTokenSize?: number): Promise<{
		[id: string]: DocumentChunk[]
	}> {
		const chunks: { [id: string]: DocumentChunk[] } = {};
		const allChunks: DocumentChunk[] = [];

		for (const doc of documents) {
			const [docChunks, docId] = this.createDocumentChunks(doc, chunkTokenSize);
			allChunks.push(...docChunks);
			chunks[docId] = docChunks;
		}

		if (allChunks.length === 0) {
			return {};
		}

		const embeddings: number[][] = [];
		for (let i = 0; i < allChunks.length; i += this.EMBEDDINGS_BATCH_SIZE) {
			const batch_texts = allChunks.slice(i, i + this.EMBEDDINGS_BATCH_SIZE).map(chunk => chunk.text);
			const batchEmbeddings = await this.openai.getEmbeddings(batch_texts);
			embeddings.push(...batchEmbeddings);
		}

		for (let i = 0; i < allChunks.length; i++) {
			allChunks[i].embedding = embeddings[i];
		}

		return chunks;
	}

	private getTextChunks(text: string, chunkTokenSize?: number): string[] {
		if (!text || text.trim() === '') {
			return [];
		}
		let tokens = this.tokenizer.encode(text);
		const chunks = [];
		const chunkSize = chunkTokenSize || this.CHUNK_SIZE;
		let numChunks = 0;

		while (tokens.length > 0 && numChunks < this.MAX_NUM_CHUNKS) {
			const chunk = tokens.slice(0, chunkSize);
			let chunkText = this.tokenizer.decode(chunk);

			if (!chunkText || chunkText.trim() === '') {
				tokens = tokens.slice(chunk.length);
				continue;
			}

			const lastPunctuation = Math.max(
				chunkText.lastIndexOf('.'),
				chunkText.lastIndexOf('?'),
				chunkText.lastIndexOf('!'),
				chunkText.lastIndexOf('\n')
			);

			if (lastPunctuation !== -1 && lastPunctuation > this.MIN_CHUNK_SIZE_CHARS) {
				chunkText = chunkText.slice(0, lastPunctuation + 1);
			}

			const chunkTextToAppend = chunkText.replace('\n', ' ').trim();

			if (chunkTextToAppend.length > this.MIN_CHUNK_LENGTH_TO_EMBED) {
				chunks.push(chunkTextToAppend);
			}

			tokens = tokens.slice(this.tokenizer.encode(chunkText).length);
			numChunks++;
		}

		if (tokens.length > 0) {
			const remainingText = this.tokenizer.decode(tokens).replace('\n', ' ').trim();
			if (remainingText.length > this.MIN_CHUNK_LENGTH_TO_EMBED) {
				chunks.push(remainingText);
			}
		}

		return chunks;
	}

	private createDocumentChunks(doc: Document, chunkTokenSize?: number): [DocumentChunk[], string] {
		if (!doc.text || doc.text.trim() === '') {
			return [[], doc.id || v4()];
		}

		const docId = doc.id || v4();
		const textChunks = this.getTextChunks(doc.text, chunkTokenSize);
		const metadata = doc.metadata ? {...doc.metadata, documentId: docId} : {documentId: docId};
		const docChunks = textChunks.map((text_chunk, i) => {
			const chunkId = `${docId}_${i}`;
			return new DocumentChunk({id: chunkId, text: text_chunk, metadata: metadata});
		});

		return [docChunks, docId];
	}

}
