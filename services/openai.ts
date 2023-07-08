import {Configuration, OpenAIApi} from 'openai';
import * as process from 'process';
import {BackOffPolicy, Retryable} from 'typescript-retry-decorator';

export class OpenAI {
	private openai: OpenAIApi;

	constructor() {
		const configuration = new Configuration({
			apiKey: process.env['OPENAI_API_KEY'],
		});
		this.openai = new OpenAIApi(configuration);
	}

	@Retryable({maxAttempts: 3, backOff: 1000, backOffPolicy: BackOffPolicy.ExponentialBackOffPolicy})
	async getEmbeddings(texts: string[]): Promise<number[][]> {
		const response = await this.openai.createEmbedding({model: 'text-embedding-ada-002', input: texts});
		const data = response.data.data; // Get the 'data' property of the response's 'data' property
		return data.map(result => result.embedding);
	}
}