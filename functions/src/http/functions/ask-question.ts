
import { RetrievalQAChain } from "langchain/chains";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { storage as adminStorage } from '../../fb.js';
import { logger } from 'firebase-functions';
import { Request, Response } from "express";
import { OpenAI } from "langchain/llms/openai";


export const askQuestion = async (req: Request, res: Response) => {

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const model = new OpenAI({ openAIApiKey: OPENAI_API_KEY, modelName: "gpt-3.5-turbo-0613", temperature: 0 });
    const openAIEmbeddings = new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY });

    const downloadResponse = await adminStorage().bucket().file(req.body.file).download();
    logger.log("Buffer length: ", downloadResponse.toString());

    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
    const docs = await textSplitter.createDocuments([downloadResponse.toString()]);
    const vectorStore = await HNSWLib.fromDocuments(docs, openAIEmbeddings);

    const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever());
    const response = await chain.call({
        query: req.body.query,
    });

    logger.log("askQuestion response", response);
    
    res.send({ result: response.text });
}