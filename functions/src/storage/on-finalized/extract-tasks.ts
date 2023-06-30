import { https, logger, storage } from 'firebase-functions';
import { storage as adminStorage, db } from '../../fb.js';
import { z } from "zod";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { loadQAStuffChain, createExtractionChainFromZod } from "langchain/chains";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import Blob from 'cross-blob'
import fetch from 'node-fetch';
import { runWith } from 'firebase-functions';


export const onFinalizeExtractTasks = runWith({ secrets: ['OPENAI_API_KEY', 'PINECONE_API_KEY', 'TRELLO_KEY', 'TRELLO_TOKEN'], timeoutSeconds: 540 }).storage.object().onFinalize(async (object) => {
    logger.log("INIT: onFinalize storage", object);
    const fileBucket = object.bucket; // Storage bucket containing the file.
    const filePath = object.name; // File path in the bucket.
    // const contentType = object.contentType; // File content type.
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;//"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";
    const PINECONE_API_KEY = process.env.PINECONE_API_KEY;//"967cb86f-f49e-4c32-87e3-18547cfa2b25";
    const PINECONE_ENVIRONMENT = "northamerica-northeast1-gcp";
    const PINECONE_INDEX = "tickets";
    const TRELLO_KEY = process.env.TRELLO_KEY;//"28fadf49b8c4aff6b3747662fd6b0840";
    const TRELLO_TOKEN = process.env.TRELLO_TOKEN;//"ATTA9989fb45d1c8b5d6cad9ae953106f371f61eaae08030846ed208073169f573aaA6A432CA";
    const model = new ChatOpenAI({ openAIApiKey: OPENAI_API_KEY, modelName: "gpt-3.5-turbo-0613", temperature: 0 });
    const openAIEmbeddings = new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY });
    const client = new PineconeClient();

    if (fileBucket && filePath) {
        try {
            //ToDo check for srt

            const fileArray = filePath.split(".");
            if (fileArray.length > 0 && fileArray[1] === 'srt') {
                const downloadResponse = await adminStorage().bucket(fileBucket).file(filePath).download();
                logger.log("Buffer length: ", downloadResponse.toString());
                const loader = new TextLoader(new Blob(downloadResponse));
                const docs = await loader.load();

                await client.init({
                    apiKey: PINECONE_API_KEY,
                    environment: PINECONE_ENVIRONMENT,
                });
                const pineconeIndex = client.Index(PINECONE_INDEX);
                await extractTasks(docs, model, openAIEmbeddings, pineconeIndex, TRELLO_KEY, TRELLO_TOKEN);

            } else {
                logger.log(`File details : `, fileArray);
            }

        } catch (error) {
            logger.error(`Something failed in the process`, error);
        }
    } else {
        throw new https.HttpsError('not-found', `No object found for ${filePath}`);
    }
});

async function extractTasks(docs, model: ChatOpenAI, openAIEmbeddings: OpenAIEmbeddings, pineconeIndex, TRELLO_KEY: string, TRELLO_TOKEN: string) {

    logger.log(`extractTasks started`);
    const loadMeetingChain = loadQAStuffChain(model);
    const response = await loadMeetingChain.call({
        input_documents: docs,
        question: "Extract tasks for each user",
        outputKey: "task",
    });
    logger.log(JSON.stringify(response));

    const createExtractionChain = createExtractionChainFromZod(
        z.object({
            "person-name": z.string().optional(),
            "person-task": z.array(z.string()).optional(),
        }),
        model
    );

    const extractionResponse: any = await createExtractionChain.run(response.text);
    logger.log(JSON.stringify(extractionResponse));

    const pineconeStore = await PineconeStore.fromExistingIndex(openAIEmbeddings, {
        pineconeIndex,
    });

    for (const user of extractionResponse) {
        for (const task of user['person-task']) {
            const resultOne = await pineconeStore.similaritySearchWithScore(task, 1);
            const firstRecord = resultOne[0];
            if (firstRecord[1] > 0.8) {
                const trelloId = firstRecord[0].metadata.id;
                logger.log(`${user['person-name']}, ${task}, ${firstRecord[0].pageContent} ${firstRecord[1]} \n`);
                const comment = `${user['person-name']}, ${task}`;
                const params = new URLSearchParams({ text: comment, key: TRELLO_KEY, token: TRELLO_TOKEN });
                const url = `https://api.trello.com/1/cards/${trelloId}/actions/comments?` + params;
                logger.log(`Trello URL is ${url}`);
                const res = await fetch(url, { method: 'post', });
                logger.log(`Trello Response : `, res);
            }
        }
    }

    logger.log(`extractTasks ended`);
}