import { https, logger, storage } from 'firebase-functions';
import { storage as adminStorage, db } from '../../fb.js';
import { z } from "zod";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { loadQAStuffChain, createExtractionChainFromZod } from "langchain/chains";
import { TextLoader } from "langchain/document_loaders/fs/text";
import Blob from 'cross-blob'
import { runWith } from 'firebase-functions';


export const onFinalizeExtractActions = runWith({ secrets: ['OPENAI_API_KEY', 'PINECONE_API_KEY', 'TRELLO_KEY', 'TRELLO_TOKEN'], timeoutSeconds: 540 }).storage.object().onFinalize(async (object) => {
    logger.log("INIT: onFinalize storage", object);
    const fileBucket = object.bucket;
    const filePath = object.name;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const model = new ChatOpenAI({ openAIApiKey: OPENAI_API_KEY, modelName: "gpt-3.5-turbo-0613", temperature: 0 });

    if (fileBucket && filePath) {
        try {
            //ToDo check for srt

            const fileArray = filePath.split(".");
            if (fileArray.length > 0 && fileArray[1] === 'srt') {
                const downloadResponse = await adminStorage().bucket(fileBucket).file(filePath).download();
                logger.log("Buffer length: ", downloadResponse.toString());
                const loader = new TextLoader(new Blob(downloadResponse));
                const docs = await loader.load();
                await extractActions(fileArray[0], docs, model);

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

async function extractActions(meetingId: string, docs, model: ChatOpenAI) {
    logger.log(`extractActions started`);
    const loadMeetingChain = loadQAStuffChain(model);

    const response = await loadMeetingChain.call({
        input_documents: docs,
        question: "Extract actions for each user from the given meeting",
        outputKey: "actions",
    });
    logger.log('loadMeetingChain response', response);

    //// use openai functions to parse the output to json structure
    const createExtractionChain = createExtractionChainFromZod(
        z.object({
            "person-name": z.string().optional(),
            "person-actions": z.array(z.string()).optional(),
        }),
        model
    );
    const extractionResponse: any = await createExtractionChain.run(response.text);
    logger.log('extractionResponse', extractionResponse);

    const items = extractionResponse.map(item => ({name: item['person-name'], actions: item['person-actions']}))



    const collectionReference = db().collection('Meetings');
    const meetingRef = collectionReference.doc(
        meetingId
    );

    const result = await meetingRef.set({actionItems: items}, { merge: true });
    logger.log('save in firebase', result);
    logger.log(`extractActions done`);
}
