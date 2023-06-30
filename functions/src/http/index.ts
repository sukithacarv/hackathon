import express from 'express';
import { runWith } from 'firebase-functions';
import { helloCallback } from './functions/hello-world.js'
import { trelloCallback } from './functions/trello-callback.js';
import { askQuestion } from './functions/ask-question.js';
import { chatMeeting } from './functions/chat-with-meeting.js';
import { chatAndCommandMeeting } from './functions/chat-and-command-with-meeting.js';
import { qaAndCommandMeeting } from './functions/qa-and-command-with-meeting.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get('/callback', helloCallback);
app.post('/callback', trelloCallback);
app.post('/qa', askQuestion);
app.post('/chat', chatMeeting);
app.post('/chat/command', chatAndCommandMeeting)
app.post('/qa/command', qaAndCommandMeeting)


export const api = runWith({ secrets: ['OPENAI_API_KEY', 'PINECONE_API_KEY', 'MOMENTO_AUTH_TOKEN', 'REDIS_PASSWORD', 'ZAPIER_KEY'] }).https.onRequest(app);