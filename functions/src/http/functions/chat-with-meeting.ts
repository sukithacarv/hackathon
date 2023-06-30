import { ConversationalRetrievalQAChain } from "langchain/chains";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { storage as adminStorage } from '../../fb.js';
import { logger } from 'firebase-functions';
import { Request, Response } from "express";
import { OpenAI } from "langchain/llms/openai";
import { RedisChatMessageHistory } from "langchain/stores/message/redis";
import { BufferMemory } from "langchain/memory";

import { ChainTool, ZapierNLAWrapper } from "langchain/tools";

import {
    initializeAgentExecutorWithOptions,
    ZapierToolKit,
} from "langchain/agents";
import { PlanAndExecuteAgentExecutor } from "langchain/experimental/plan_and_execute";



export const chatMeeting = async (req: Request, res: Response) => {


    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
    const REDIS_ENDPOINT = 'redis-10240.c274.us-east-1-3.ec2.cloud.redislabs.com:10240';
    const ZAPIER_KEY = process.env.ZAPIER_KEY;

    const model = new OpenAI({ openAIApiKey: OPENAI_API_KEY, modelName: "gpt-4", temperature: 0.7 });
    const openAIEmbeddings = new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY });

    const zapier = new ZapierNLAWrapper({ apiKey: ZAPIER_KEY });
    const toolkit = await ZapierToolKit.fromZapierNLAWrapper(zapier);

    const downloadResponse = await adminStorage().bucket().file(`${req.body.file}.srt`).download();
    logger.log("Buffer length: ", downloadResponse.toString());

    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
    const docs = await textSplitter.createDocuments([downloadResponse.toString()]);
    const vectorStore = await HNSWLib.fromDocuments(docs, openAIEmbeddings);
    const memory = new BufferMemory({
        memoryKey: 'chat_history',
        chatHistory: new RedisChatMessageHistory({
            sessionId: req.body.sessionId,  // change this
            sessionTTL: 3600,
            config: {
                url: `redis://default:${REDIS_PASSWORD}@r${REDIS_ENDPOINT}`,
            },
        }),
    });

    const chain = ConversationalRetrievalQAChain.fromLLM(
        model,
        vectorStore.asRetriever(),
        {
            memory: memory
        }
    );

    const question = req.body.query;
    const response = await chain.call({ question });
    
    logger.log("Char response: ", response);

    ///////////////////////

    res.send({ result: response.text });
}


