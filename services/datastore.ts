import {createClient, SupabaseClient} from '@supabase/supabase-js'
import {
	Document,
	DocumentChunkMetadata,
	DocumentChunkWithScore,
	DocumentMetadataFilter,
	QueryResult,
	QueryWithEmbedding
} from "../models/models";
import {Chunks} from './chunks';
import * as process from 'process';

const DEFAULT_SUPABASE_URL = 'http://localhost:54321';

export class MergedDataStore {
	client: SupabaseClient
	chunks: Chunks

	constructor() {
		const SUPABASE_URL = process.env['SUPABASE_URL'];
		const SUPABASE_ANON_KEY = process.env['SUPABASE_ANON_KEY'];
		const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];
		if (!SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
			throw new Error('At least one of [SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY] must be set.');
		}
		this.client = createClient(SUPABASE_URL || DEFAULT_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);
		this.chunks = new Chunks();
	}

	async upsert(table: string, documents: Document[], chunkTokenSize?: number): Promise<string[]> {
		// Delete any existing vectors for documents with the input document ids
		await Promise.all(
			documents
				.filter(document => document.id)
				.map(document => this.deleteByFilters(table, {document_id: document.id}))
		);

		const chunks = await this.chunks.getDocumentChunks(documents, chunkTokenSize);

		// Iterate over each chunk array and upsert it into the database
		for (const document_id of Object.keys(chunks)) {
			for (const chunk of chunks[document_id]) {
				const json: any = {
					"id": chunk.id,
					"content": chunk.text,
					"embedding": chunk.embedding,
					"document_id": document_id,
					"source": chunk.metadata.source,
					"source_id": chunk.metadata.source_id,
					"url": chunk.metadata.url,
					"author": chunk.metadata.author
				};
				if (chunk.metadata.created_at) {
					console.log('chunk.metadata.created_at:', chunk.metadata.created_at);
					json["created_at"] = new Date(Number(chunk.metadata.created_at)).toISOString();
				}
				await this.client.from(table).upsert(json);
			}
		}

		return Object.keys(chunks);
	}

	private async _upsert(table: string, chunks: any[]): Promise<void> {
		for (const chunk of chunks) {
			if (chunk.created_at) {
				chunk.created_at = chunk.created_at[0].toISOString();
			}
			await this.client.from(table).upsert(chunk);
		}
	}

	async rpc(functionName: string, params: { [key: string]: any }): Promise<any> {
		if (params.in_start_date) {
			params.in_start_date = params.in_start_date.toISOString()
		}
		if (params.in_end_date) {
			params.in_end_date = params.in_end_date.toISOString()
		}
		const {data, error} = await this.client.rpc(functionName, params)
		if (error) throw error
		return data
	}

	async deleteLike(table: string, column: string, pattern: string): Promise<void> {
		await this.client.from(table).delete().like(column, pattern)
	}

	async deleteIn(table: string, column: string, ids: string[]): Promise<void> {
		await this.client.from(table).delete().in(column, ids)
	}

	async deleteByFilters(table: string, filter: DocumentMetadataFilter): Promise<void> {
		let builder = this.client.from(table).delete()
		if (filter.document_id) {
			builder = builder.eq('document_id', filter.document_id)
		}
		if (filter.source) {
			builder = builder.eq('source', filter.source)
		}
		if (filter.source_id) {
			builder = builder.eq('source_id', filter.source_id)
		}
		if (filter.author) {
			builder = builder.eq('author', filter.author)
		}
		if (filter.start_date) {
			builder = builder.gte('created_at', new Date(Number(filter.start_date)).toISOString())
		}
		if (filter.end_date) {
			builder = builder.lte('created_at', new Date(Number(filter.end_date)).toISOString())
		}
		await builder
	}

	async query(queries: QueryWithEmbedding[]): Promise<QueryResult[]> {
		const queryResults: QueryResult[] = [];

		for (const query of queries) {
			const params: any = {
				in_query: query.query,
				in_embedding: query.embedding,
				in_top_k: query.top_k || 3
			};

			if (query.filter) {
				if (query.filter.document_id) {
					params.in_document_id = query.filter.document_id;
				}
				if (query.filter.source) {
					params.in_source = query.filter.source;
				}
				if (query.filter.source_id) {
					params.in_source_id = query.filter.source_id;
				}
				if (query.filter.author) {
					params.in_author = query.filter.author;
				}
				if (query.filter.start_date) {
					params.in_start_date = new Date(Number(query.filter.start_date)).toISOString();
				}
				if (query.filter.end_date) {
					params.in_end_date = new Date(Number(query.filter.end_date)).toISOString();
				}
			}

			const data = await this.rpc('match_page_sections', params);

			const results: DocumentChunkWithScore[] = data.map((row: any) => {
				const chunk = new DocumentChunkWithScore();
				chunk.id = row.id;
				chunk.text = row.content;
				chunk.metadata = new DocumentChunkMetadata({
					created_at: row.created_at,
					source: row.source,
					source_id: row.source_id
				}, row.document_id);
				chunk.score = row.score;
				return chunk;
			});

			queryResults.push(new QueryResult({
				query: query.query,
				results: results
			}));
		}

		return queryResults;
	}

}