import {OpenAI} from './openai';
import {Document, DocumentChunk} from '../models/models';
import {v4} from 'uuid';
import {get_encoding, Tiktoken} from 'tiktoken';

export class Chunks {
	private CHUNK_SIZE = 200;
	private MIN_CHUNK_SIZE_CHARS = 350;
	private MIN_CHUNK_LENGTH_TO_EMBED = 5;
	private EMBEDDINGS_BATCH_SIZE = 128; // This should be set from environment variable
	private MAX_NUM_CHUNKS = 10000;
	private openai: OpenAI;
	private tokenizer: Tiktoken;

	constructor() {
		this.openai = new OpenAI();
		this.tokenizer = get_encoding(
			"cl100k_base"
		)
	}

	public async getDocumentChunks(documents: Document[], chunk_token_size?: number): Promise<{
		[id: string]: DocumentChunk[]
	}> {
		let chunks: { [id: string]: DocumentChunk[] } = {};
		let all_chunks: DocumentChunk[] = [];

		for (let doc of documents) {
			let [doc_chunks, doc_id] = this.createDocumentChunks(doc, chunk_token_size);
			all_chunks.push(...doc_chunks);
			chunks[doc_id] = doc_chunks;
		}

		if (all_chunks.length === 0) {
			return {};
		}

		let embeddings: number[][] = [];
		for (let i = 0; i < all_chunks.length; i += this.EMBEDDINGS_BATCH_SIZE) {
			let batch_texts = all_chunks.slice(i, i + this.EMBEDDINGS_BATCH_SIZE).map(chunk => chunk.text);
			let batch_embeddings = await this.openai.getEmbeddings(batch_texts);
			embeddings.push(...batch_embeddings);
		}

		for (let i = 0; i < all_chunks.length; i++) {
			all_chunks[i].embedding = embeddings[i];
		}

		return chunks;
	}

	private getTextChunks(text: string, chunk_token_size?: number): string[] {
		if (!text || text.trim() === '') {
			return [];
		}
		let textDecoder = new TextDecoder('utf-8');
		let tokens = this.tokenizer.encode(text);
		let chunks = [];
		let chunk_size = chunk_token_size || this.CHUNK_SIZE;
		let num_chunks = 0;

		while (tokens.length > 0 && num_chunks < this.MAX_NUM_CHUNKS) {
			let chunk = tokens.slice(0, chunk_size);
			let chunk_text = textDecoder.decode(this.tokenizer.decode(chunk));

			if (!chunk_text || chunk_text.trim() === '') {
				tokens = tokens.slice(chunk.length);
				continue;
			}

			let last_punctuation = Math.max(
				chunk_text.lastIndexOf('.'),
				chunk_text.lastIndexOf('?'),
				chunk_text.lastIndexOf('!'),
				chunk_text.lastIndexOf('\n')
			);

			if (last_punctuation !== -1 && last_punctuation > this.MIN_CHUNK_SIZE_CHARS) {
				chunk_text = chunk_text.slice(0, last_punctuation + 1);
			}

			let chunk_text_to_append = chunk_text.replace('\n', ' ').trim();

			if (chunk_text_to_append.length > this.MIN_CHUNK_LENGTH_TO_EMBED) {
				chunks.push(chunk_text_to_append);
			}

			tokens = tokens.slice(this.tokenizer.encode(chunk_text).length);
			num_chunks++;
		}

		if (tokens.length > 0) {
			let remaining_text = textDecoder.decode(this.tokenizer.decode(tokens)).replace('\n', ' ').trim();
			if (remaining_text.length > this.MIN_CHUNK_LENGTH_TO_EMBED) {
				chunks.push(remaining_text);
			}
		}

		return chunks;
	}

	private createDocumentChunks(doc: Document, chunk_token_size?: number): [DocumentChunk[], string] {
		if (!doc.text || doc.text.trim() === '') {
			return [[], doc.id || v4()];
		}

		let doc_id = doc.id || v4();
		let text_chunks = this.getTextChunks(doc.text, chunk_token_size);
		let metadata = doc.metadata ? {...doc.metadata, document_id: doc_id} : {document_id: doc_id};
		let doc_chunks = text_chunks.map((text_chunk, i) => {
			let chunk_id = `${doc_id}_${i}`;
			return new DocumentChunk({id: chunk_id, text: text_chunk, metadata: metadata});
		});

		return [doc_chunks, doc_id];
	}

}
