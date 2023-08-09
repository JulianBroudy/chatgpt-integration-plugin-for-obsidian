import IUpdatableClient from "src/interfaces/IUpdatableClient";

export default class ServiceLocator {
	public static OPEN_AI_SERVICE = 'openAiService';
	public static DATASTORE_SERVICE = 'datastoreService';
	public static CHUNKIFYING_SERVICE = 'chunkifyingService';
	static DATABASE_POLLING_SERVICE = 'databasePollingService';
	static UI_CONTROLLER: 'uiController';
	private static instance: ServiceLocator;
	private services: Map<string, any>;

	private constructor() {
		this.services = new Map();
	}

	static getInstance(): ServiceLocator {
		if (!ServiceLocator.instance) {
			ServiceLocator.instance = new ServiceLocator();
		}
		return ServiceLocator.instance;
	}

	registerService(key: string, instance: any) {
		this.services.set(key, instance);
	}

	getService<T>(key: string): T {
		return this.services.get(key);
	}

	getUpdatableServices(): IUpdatableClient[] {
		const updatableServices: IUpdatableClient[] = [];
		for (const service of this.services.values()) {
			if (typeof service.updateClient === 'function') {
				updatableServices.push(service);
			}
		}
		return updatableServices;
	}

}
