import IUpdatableClient from "../interfaces/IUpdatableClient";
import {DataStore} from "./datastore";
import {CommandStatus, CommandWithContent} from "../models/models";
import LOGGER from 'src/utils/Logger';

export class DatabasePolling implements IUpdatableClient {
	private intervalId: NodeJS.Timeout | null = null;
	private datastore: DataStore;
	private pollIntervalSeconds: number;

	constructor(datastore: DataStore, pollIntervalSeconds: number) {
		this.datastore = datastore;
		this.pollIntervalSeconds = pollIntervalSeconds;
		LOGGER.info('DatabasePoller initialized with poll interval:', pollIntervalSeconds, 'seconds');
	}

	updateClient(): Promise<void> {
		return Promise.resolve(undefined);
	}

	private setPollIntervalSeconds(newIntervalSeconds: number) {
		LOGGER.info('Updating poll interval from', this.pollIntervalSeconds, 'to', newIntervalSeconds, 'seconds');
		this.pollIntervalSeconds = newIntervalSeconds;

		// If polling is active, reset it with the new interval
		if (this.intervalId) {
			this.resetPolling();
			this.startPolling();
		}
	}

	activate() {
		this.startPolling();
		LOGGER.info('DatabasePoller activated');
	}

	deactivate() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
		}
		LOGGER.info('DatabasePoller deactivated');
	}

	toggle() {
		if (this.intervalId) {
			this.deactivate();
		} else {
			this.activate();
		}
	}

	private startPolling() {
		this.intervalId = setInterval(async () => {
			try {
				const command = await this.datastore.pollCommand();
				if (command) {
					this.resetPolling();
					LOGGER.info('Command received:', command);
					await this.handleCommand(command);
					await this.datastore.updateCommandStatus(command.id!, CommandStatus.COMPLETED);
					LOGGER.info('Command completed:', command);
					this.startPolling();
				}
			} catch (error) {
				LOGGER.error('Error in polling:', error);
			}
		}, this.pollIntervalSeconds * 1000);
		LOGGER.info('Polling started');
	}

	private resetPolling() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		LOGGER.info('Polling reset');
	}

	private async handleCommand(command: CommandWithContent) {
		// Handle the command logic here
		LOGGER.info('Handling command:', command);
	}

}

