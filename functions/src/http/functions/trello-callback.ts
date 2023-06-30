import { logger } from "firebase-functions";
import { Request, Response } from "express";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { Document } from "langchain/document";

export const trelloCallback = async (req: Request, res: Response) => {
    logger.log("INIT: trello callback", req.body);


    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;//"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";
    const PINECONE_API_KEY = process.env.PINECONE_API_KEY;//"967cb86f-f49e-4c32-87e3-18547cfa2b25";
    const PINECONE_ENVIRONMENT = "northamerica-northeast1-gcp";
    const PINECONE_INDEX = "tickets";
    const openAIEmbeddings = new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY });

    const client = new PineconeClient();
    await client.init({
        apiKey: PINECONE_API_KEY,
        environment: PINECONE_ENVIRONMENT,
    });
    const pineconeIndex = client.Index(PINECONE_INDEX);
    const action = req.body?.action;
    const type = action?.type;
    if (type) {
        const pineconeStore = await PineconeStore.fromExistingIndex(openAIEmbeddings, {
            pineconeIndex,
        });
        if (type === "createCard") {
            const card = action.data.card;
            const pineconeDocs = [
                new Document({
                    metadata: { id: card.id },
                    pageContent: card.name,
                })
            ];
            await pineconeStore.addDocuments(pineconeDocs, [card.id]);
            // lets store this is a vector db
            logger.log("trelloCallback create card", card);
        } else if (type === 'deleteCard') {
            const card = action.data.card;
            await pineconeIndex.delete1({ids: [card.id]})
            // lets store this is a vector db
            logger.log("trelloCallback delete card", card);
        }
    } else {
        logger.log("trelloCallback type is not available");
    }
    res.send({ result: 'OK' });
};