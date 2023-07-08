// import * as fs from 'fs';
// import {promisify} from 'util';
//
// const readFile = promisify(fs.readFile);
//
// async function processJsonDump(filepath: string, customMetadata: any, screenForPii: boolean, extractMetadata: boolean): Promise<void> {
// 	const data: any[] = JSON.parse(await readFile(filepath, 'utf-8'));
// 	const documents: Document[] = [];
// 	const skippedItems: any[] = [];
//
// 	for (const item of data) {
// 		try {
// 			const id = item.id || uuid.v4();
// 			const text = item.text;
// 			if (!text) {
// 				console.log("No document text, skipping...");
// 				continue;
// 			}
//
// 			const metadata: DocumentMetadata = {
// 				source: item.source,
// 				source_id: item.source_id,
// 				url: item.url,
// 				created_at: item.created_at,
// 				author: item.author,
// 				...customMetadata
// 			};
//
// 			if (screenForPii) {
// 				const piiDetected = await screenTextForPii(text);
// 				if (piiDetected) {
// 					console.log("PII detected in document, skipping");
// 					skippedItems.push(item);
// 					continue;
// 				}
// 			}
//
// 			if (extractMetadata) {
// 				const extractedMetadata = await extractMetadataFromDocument(`Text: ${text}; Metadata: ${JSON.stringify(metadata)}`);
// 				metadata = {...metadata, ...extractedMetadata};
// 			}
//
// 			const document: Document = {id, text, metadata};
// 			documents.push(document);
// 		} catch (error) {
// 			console.error(`Error processing ${JSON.stringify(item)}: ${error}`);
// 			skippedItems.push(item);
// 		}
// 	}
//
// 	for (let i = 0; i < documents.length; i += DOCUMENT_UPSERT_BATCH_SIZE) {
// 		const batchDocuments = documents.slice(i, i + DOCUMENT_UPSERT_BATCH_SIZE);
// 		console.log(`Upserting batch of ${batchDocuments.length} documents, batch ${i}`);
// 		await datastore.upsert(batchDocuments);
// 	}
//
// 	console.log(`Skipped ${skippedItems.length} items due to errors or PII detection`);
// 	for (const item of skippedItems) {
// 		console.log(JSON.stringify(item));
// 	}
// }
//
// async function main() {
// 	const filepath = process.argv[2];
// 	const customMetadata = JSON.parse(process.argv[3] || "{}");
// 	const screenForPii = process.argv[4] === "true";
// 	const extractMetadata = process.argv[5] === "true";
//
// 	const datastore = await getDatastore();
// 	await processJsonDump(filepath, customMetadata, screenForPii, extractMetadata);
// }
//
// main().catch(console.error);
