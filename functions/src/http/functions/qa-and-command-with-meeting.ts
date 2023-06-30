import { ConversationalRetrievalQAChain, VectorDBQAChain } from "langchain/chains";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { storage as adminStorage } from '../../fb.js';
import { logger } from 'firebase-functions';
import { Request, Response } from "express";
import { OpenAI } from "langchain/llms/openai";

import { ChainTool, ZapierNLAWrapper } from "langchain/tools";

import {
    ZapierToolKit, initializeAgentExecutorWithOptions,
} from "langchain/agents";
import { PlanAndExecuteAgentExecutor } from "langchain/experimental/plan_and_execute";

export const qaAndCommandMeeting = async (req: Request, res: Response) => {

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ZAPIER_KEY = process.env.ZAPIER_KEY;

    const model = new OpenAI({ openAIApiKey: OPENAI_API_KEY, modelName: "gpt-4-0613", temperature: 0.7 });
    const openAIEmbeddings = new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY });

    const zapier = new ZapierNLAWrapper({ apiKey: ZAPIER_KEY });
    const toolkit = await ZapierToolKit.fromZapierNLAWrapper(zapier);

    const downloadResponse = await adminStorage().bucket().file(req.body.file).download();
    logger.log("Buffer length: ", downloadResponse.toString());

    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
    const docs = await textSplitter.createDocuments([downloadResponse.toString()]);
    const vectorStore = await HNSWLib.fromDocuments(docs, openAIEmbeddings);

    const chain = VectorDBQAChain.fromLLM(model, vectorStore);

    ////// new code///////
    const qaTool = new ChainTool({
        name: "meeting-chain-tool",
        description:
            "Meeting document - useful for when you need to ask questions about the meeting.",
        chain: chain,
    });

    // const executor = PlanAndExecuteAgentExecutor.fromLLMAndTools({
    //     llm: model,
    //     tools: [qaTool, ...toolkit.tools],
    //     verbose: true,
        
    // });

    const executor = await initializeAgentExecutorWithOptions([qaTool, ...toolkit.tools], model, {
        agentType: "zero-shot-react-description",
        verbose: true
      });

    const input = req.body.query;
    const response = await executor.call({ input });

    ///////////////////////

    res.send({ result: response.output });
}


