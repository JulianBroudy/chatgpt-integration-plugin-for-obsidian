enum Source {
	email = "email", file = "file", chat = "chat"
}

class DocumentMetadata {
	source?: Source;
	source_id?: string;
	url?: string;
	created_at?: string;
	author?: string;

	constructor(data?: { created_at: string; source: string; source_id: string }) {
		Object.assign(this, data);
	}

}

class DocumentChunkMetadata extends DocumentMetadata {
	document_id?: string;

	constructor(data: { created_at: string; source: string; source_id: string }, document_id: string) {
		super(data);
		this.document_id = document_id;
	}
}

class DocumentChunk {
	id?: string;
	text: string;
	metadata: DocumentChunkMetadata;
	embedding?: number[];

	constructor(data?: { id: string; text: string, metadata: DocumentChunkMetadata }) {
		Object.assign(this, data);
	}
}

class DocumentChunkWithScore extends DocumentChunk {
	score: number;
}

class Document {
	id?: string;
	text: string;
	metadata?: DocumentMetadata;

	constructor(data?: { id: string; text: string, metadata: DocumentMetadata }) {
		Object.assign(this, data);
	}
}

class DocumentWithChunks extends Document {
	chunks: DocumentChunk[];
}

class DocumentMetadataFilter {
	document_id?: string;
	source?: Source;
	source_id?: string;
	author?: string;
	start_date?: string;  // any date string format
	end_date?: string;  // any date string format

	constructor(data?: Partial<DocumentMetadataFilter>) {
		Object.assign(this, data);
	}
}

class Query {
	query: string;
	filter?: DocumentMetadataFilter;
	top_k?: number;
}

class QueryWithEmbedding extends Query {
	embedding: number[];
}

class QueryResult {
	query: string;
	results: DocumentChunkWithScore[];

	constructor(data: {query: string, results: DocumentChunkWithScore[]}) {
		Object.assign(this, data);
	}
}

export {
	Source,
	DocumentMetadata,
	DocumentChunkMetadata,
	DocumentChunk,
	DocumentChunkWithScore,
	Document,
	DocumentWithChunks,
	DocumentMetadataFilter,
	Query,
	QueryWithEmbedding,
	QueryResult
};

