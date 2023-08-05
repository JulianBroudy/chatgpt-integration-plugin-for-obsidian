enum Source {
	EMAIL = "EMAIL", FILE = "FILE", CHAT = "CHAT"
}

class DocumentMetadata {
	source?: Source;
	sourceId?: string;
	url?: string;
	createdAt?: string;
	author?: string;

	constructor(data?: { createdAt: string; source: string; sourceId: string; author?: string }) {
		Object.assign(this, data);
	}

}

class DocumentChunkMetadata extends DocumentMetadata {
	documentId?: string;

	constructor(data: { createdAt: string; source: string; sourceId: string }, documentId: string) {
		super(data);
		this.documentId = documentId;
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
	documentId?: string;
	source?: Source;
	sourceId?: string;
	author?: string;
	startDate?: string;  // any date string format
	endDate?: string;  // any date string format

	constructor(data?: Partial<DocumentMetadataFilter>) {
		Object.assign(this, data);
	}
}

class Query {
	query: string;
	filter?: DocumentMetadataFilter;
	topK?: number;
}

class QueryWithEmbedding extends Query {
	embedding: number[];
}

class QueryResult {
	query: string;
	results: DocumentChunkWithScore[];

	constructor(data: { query: string, results: DocumentChunkWithScore[] }) {
		Object.assign(this, data);
	}
}

enum CommandStatus {
	NEW = "NEW",
	PROCESSING = "PROCESSING",
	COMPLETED = "COMPLETED",
	ABANDONED = "ABANDONED",
	ERROR = "ERROR"
}

enum CommandType {
	CREATE_NOTE = "CREATE_NOTE",
	MODIFY_NOTE = "MODIFY_NOTE",
	DELETE_NOTE = "DELETE_NOTE"
}

class CommandContent {
	text: string;
	metadata: DocumentMetadata

	constructor(data: { text: string, metadata: DocumentMetadata }) {
		Object.assign(this, data);
	}
}

class Command {
	id?: string;
	status: CommandStatus = CommandStatus.NEW;
	errors?: string;
	created_at?: string;
	updated_at?: string;

	constructor(data?: { id: string; status: CommandStatus; errors?: string; created_at?: string; updated_at?: string }) {
		Object.assign(this, data);
	}

}

class CommandWithContent extends Command {
	type: CommandType;
	content: CommandContent;

	constructor(data: { type: CommandType; content: CommandContent; id: string; status: CommandStatus; errors?: string; created_at?: string; updated_at?: string }) {
		super(data);
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
	QueryResult,
	CommandStatus,
	CommandType,
	CommandContent,
	Command,
	CommandWithContent
};

