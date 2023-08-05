import {createClient, SupabaseClient} from '@supabase/supabase-js'
import {
	CommandStatus,
	CommandWithContent,
	Document,
	DocumentChunkMetadata,
	DocumentChunkWithScore,
	DocumentMetadataFilter,
	QueryResult,
	QueryWithEmbedding
} from "../models/models";
import {Chunks} from './chunks';
import LOGGER from 'src/utils/Logger';
import {ChatGPTEnablerSettings} from 'src/interfaces/ISettings';
import IUpdatableClient from "../interfaces/IUpdatableClient";
import {Notice} from "obsidian";


export class DataStore implements IUpdatableClient {
	private client: SupabaseClient;
	private chunks: Chunks;
	private settings: ChatGPTEnablerSettings;
	private lastConnectionConfigurations = {
		"serviceRoleKey": '',
		"anonKey": '',
		"url": ''
	}

	constructor(settings: ChatGPTEnablerSettings, chunks: Chunks) {
		this.settings = settings;
		this.chunks = chunks;
		this.updateClient();
	}

	async updateClient(): Promise<void> {
		const activeKey = this.settings.supabaseKeys.currentlyActiveKey;
		const activeKeyValue = this.settings.supabaseKeys[activeKey].value;

		if (!activeKeyValue) {
			const errorMessage = `The currently active key [${activeKey}] must be set.`;
			LOGGER.error(errorMessage);
			throw new Error(errorMessage);
		}

		if (this.client) {
			// Update the existing client with the new settings
			if (this.lastConnectionConfigurations[activeKey] !== activeKeyValue || this.settings.supabaseUrl !== this.lastConnectionConfigurations['url']) {
				// Only create a new client if the active key has changed
				const {error} = await this.client.auth.signOut();
				if (error) LOGGER.error('Error logging out:', error);
				this.client = createClient(this.settings.supabaseUrl, activeKeyValue);
			} else {
				new Notice("The configurations are identical to previous ones.")
			}
		} else {
			this.client = createClient(this.settings.supabaseUrl, activeKeyValue);
		}

		// Update the lastKeys object
		this.lastConnectionConfigurations[activeKey] = activeKeyValue;
		this.lastConnectionConfigurations['url'] = this.settings.supabaseUrl;
	}


	async upsert(table: string, documents: Document[], chunkTokenSize?: number): Promise<string[]> {
		LOGGER.debug("Deleting existing documents...");
		// Delete any existing vectors for documents with the input document ids
		await Promise.all(
			documents
				.filter(document => document.id)
				.map(document => this.deleteByFilters(table, {documentId: document.id}))
		);

		const chunks = await this.chunks.getDocumentChunks(documents, chunkTokenSize);

		LOGGER.debug("Upserting chunks...");
		// Iterate over each chunk array and upsert it into the database
		for (const documentId of Object.keys(chunks)) {
			for (const chunk of chunks[documentId]) {
				const json: any = {
					"id": chunk.id,
					"content": chunk.text,
					"embedding": chunk.embedding,
					"documentId": documentId,
					"source": chunk.metadata.source,
					"sourceId": chunk.metadata.sourceId,
					"url": chunk.metadata.url,
					"author": chunk.metadata.author
				};
				if (chunk.metadata.createdAt) {
					console.log('chunk.metadata.createdAt:', chunk.metadata.createdAt);
					json["createdAt"] = new Date(Number(chunk.metadata.createdAt)).toISOString();
				}
				LOGGER.debug("Upserting [{}]", json);
				await this.client.from(table).upsert(json);
			}
		}

		return Object.keys(chunks);
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
		if (filter.documentId) {
			builder = builder.eq('document_id', filter.documentId)
		}
		if (filter.source) {
			builder = builder.eq('source', filter.source)
		}
		if (filter.sourceId) {
			builder = builder.eq('source_id', filter.sourceId)
		}
		if (filter.author) {
			builder = builder.eq('author', filter.author)
		}
		if (filter.startDate) {
			builder = builder.gte('createdAt', new Date(Number(filter.startDate)).toISOString())
		}
		if (filter.endDate) {
			builder = builder.lte('createdAt', new Date(Number(filter.endDate)).toISOString())
		}
		await builder
	}

	async query(queries: QueryWithEmbedding[]): Promise<QueryResult[]> {
		const queryResults: QueryResult[] = [];

		for (const query of queries) {
			const params: any = {
				in_query: query.query,
				in_embedding: query.embedding,
				in_top_k: query.topK || 3
			};

			if (query.filter) {
				if (query.filter.documentId) {
					params.in_document_id = query.filter.documentId;
				}
				if (query.filter.source) {
					params.in_source = query.filter.source;
				}
				if (query.filter.sourceId) {
					params.in_source_id = query.filter.sourceId;
				}
				if (query.filter.author) {
					params.in_author = query.filter.author;
				}
				if (query.filter.startDate) {
					params.in_start_date = new Date(Number(query.filter.startDate)).toISOString();
				}
				if (query.filter.endDate) {
					params.in_end_date = new Date(Number(query.filter.endDate)).toISOString();
				}
			}

			const data = await this.rpc('match_page_sections', params);

			const results: DocumentChunkWithScore[] = data.map((row: any) => {
				const chunk = new DocumentChunkWithScore();
				chunk.id = row.id;
				chunk.text = row.content;
				chunk.metadata = new DocumentChunkMetadata({
					createdAt: row.createdAt,
					source: row.source,
					sourceId: row.source_id
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

	// Function to poll command from database
	async pollCommand(): Promise<CommandWithContent | null> {
		const {
			data,
			error
		} = await this.client.from('commands').select('*').eq('status', CommandStatus.NEW).order("created_at", {ascending: true}).limit(1);
		if (error) {
			LOGGER.error(error);
			throw error;
		}

		if (data.length === 0) {
			LOGGER.debug("No new commands found.");
			return null;
		}

		LOGGER.info("Got data from database [{}]", data[0]);
		const commandWithContent: CommandWithContent = new CommandWithContent(data[0]);
		LOGGER.info("Found new command [{}]", commandWithContent);

		this.updateCommandStatus(commandWithContent.id!, CommandStatus.PROCESSING);

		return commandWithContent;
	}

	// Function to update command status by id
	async updateCommandStatus(id: string, status: CommandStatus): Promise<void> {
		await this.client.from('commands').update({
			status: status
		}).eq('id', id);
	}

	private async _upsert(table: string, chunks: any[]): Promise<void> {
		for (const chunk of chunks) {
			if (chunk.createdAt) {
				chunk.createdAt = chunk.createdAt[0].toISOString();
			}
			await this.client.from(table).upsert(chunk);
		}
	}

}
