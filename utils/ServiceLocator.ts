import IUpdatableClient from "interfaces/IUpdatableClient";

export default class ServiceLocator {
	private static instance: ServiceLocator;
	private services: Map<string, any>;

	public static OPEN_AI_SERVICE = 'openAiService';
	public static DATASTORE_SERVICE = 'datastoreService';
	public static CHUNKIFYING_SERVICE = 'chunkifyingService';

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
