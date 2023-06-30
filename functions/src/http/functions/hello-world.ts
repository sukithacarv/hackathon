import { logger } from "firebase-functions";
import { Request, Response } from "express";

export const helloCallback = async (req: Request, res: Response) => {
    logger.log("INIT: helloWorld");
    res.send({ result: 'OK' });
};