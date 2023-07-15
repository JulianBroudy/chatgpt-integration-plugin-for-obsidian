import {ChatGPTEnablerSettings} from 'interfaces/ISettings';
import {Configuration, OpenAIApi} from 'openai';
import {BackOffPolicy, Retryable} from 'typescript-retry-decorator';
import LOGGER from 'utils/Logger';
import IUpdatableClient from "../interfaces/IUpdatableClient";
import {Notice} from "obsidian";

export class OpenAI implements IUpdatableClient {
	private openai: OpenAIApi;
	private settings: ChatGPTEnablerSettings;
	private lastAPIKey: string;

	constructor(settings: ChatGPTEnablerSettings) {
		this.settings = settings;
		this.updateClient();
	}

	async updateClient(): Promise<void> {
		if (this.openai && this.lastAPIKey === this.settings.openAIApiKey.value) {
			new Notice("OpenAI API Key hasn't changed.")
		} else {
			this.openai = new OpenAIApi(new Configuration({
				apiKey: this.settings.openAIApiKey.value,
			}));
			this.lastAPIKey = this.settings.openAIApiKey.value;
			// TODO: Add validation when settings are updated.
			new Notice("OpenAI API Key was updated.\nEarly validation isn't supported yet.")
		}

	}

	@Retryable({maxAttempts: 3, backOff: 1000, backOffPolicy: BackOffPolicy.ExponentialBackOffPolicy})
	async getEmbeddings(texts: string[]): Promise<number[][]> {
		LOGGER.debug("getEmbeddings texts=[{}]", texts);
		const response = await this.openai.createEmbedding({model: 'text-embedding-ada-002', input: texts});
		const data = response.data.data; // Get the 'data' property of the response's 'data' property
		return data.map(result => result.embedding);
	}
}
