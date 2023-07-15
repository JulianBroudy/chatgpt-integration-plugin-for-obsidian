export default interface IUpdatableClient {
	updateClient(): Promise<void>
}