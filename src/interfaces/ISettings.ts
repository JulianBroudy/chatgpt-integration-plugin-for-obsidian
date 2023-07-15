export interface SensitiveConfiguration {
	value: string;
	isVisible: boolean;
}

export interface ChatGPTEnablerSettings {
	openAIApiKey: SensitiveConfiguration;
	supabaseUrl: string;
	supabaseKeys: {
		anonKey: SensitiveConfiguration;
		serviceRoleKey: SensitiveConfiguration;
		currentlyActiveKey: 'anonKey' | 'serviceRoleKey';
	};
}