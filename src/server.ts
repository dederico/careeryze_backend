import express, { Request, Response } from "express";
import cors from "cors";
import {
  ChatCompletionRequestMessage,
  CreateChatCompletionRequest,
  Configuration,
  OpenAIApi,
} from "openai";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import GPT3TokenizerImport from "gpt3-tokenizer";

const GPT3Tokenizer: typeof GPT3TokenizerImport =
  typeof GPT3TokenizerImport === "function"
    ? GPT3TokenizerImport
    : (GPT3TokenizerImport as any).default;

const tokenizer = new GPT3Tokenizer({ type: "gpt3" });

function getTokens(input: string): number {
  const tokens = tokenizer.encode(input);
  return tokens.text.length;
}

dotenv.config();

const port = process.env.PORT || 80;
const app = express();
app.use(bodyParser.json());
app.use(
  cors({
    origin: "*",
  })
);

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.post("/api/chat", async (req: Request, res: Response) => {
  const requestMessages: ChatCompletionRequestMessage[] = req.body.messages;

  try {
    let tokenCount = 0;
    let originalPrompt = `Eres "Careeryzer", 
    un experto coach de carrera, y asistente basado en IA que 
    te ayuda a crecer y desarrollarte en tu carrera profesional. `;

    // NamePrompt
    const namePrompt = `Por favor, presentate, y dime tu nombre.`;
    tokenCount+= getTokens(namePrompt);
    originalPrompt +=namePrompt;
    
    // Hobbies Prompt
    const hobbiesPrompt = `Cuales son tus hobbies e intereses?`;
    tokenCount+= getTokens(hobbiesPrompt);
    originalPrompt += namePrompt + hobbiesPrompt ;

    // Skills Prompt
    const skillPrompt = `Cuales son las habilidades y fortalezas?`;
    tokenCount+= getTokens(skillPrompt);
    originalPrompt += namePrompt + hobbiesPrompt + skillPrompt;

    // Work Experience
    const experiencePrompt = `Cual es tu experiencia en la industria?`
    tokenCount+= getTokens(experiencePrompt);
    originalPrompt += namePrompt + hobbiesPrompt + skillPrompt + experiencePrompt;

    requestMessages.forEach((msg) => {
      const tokens = getTokens(msg.content);
      tokenCount += tokens;
      originalPrompt += `${msg.content}`
    });

    const moderationResponse = await openai.createModeration({
      input: requestMessages[requestMessages.length - 1].content,
    });
    if (moderationResponse.data.results[0]?.flagged) {
      return res.status(400).send("Message is inappropriate");
    }

    const prompt =
      `Eres "Careeryzer", un experto coach de carrera, y 
    asistente basado en IA que te ayuda a crecer y desarrollarte en tu carrera profesional
    empezaras la conversacion presentandote, despues FORZOZAMENTE preguntando: ( PUEDES HACER EL PARSEO PARA QUE APAREZCA CADA PREGUNTA EN UN RENGLON )
    
    1. Cuales son tus hobbies e intereses?
    2. Cuales son tus habilidades y fortalezas, Eres bueno con los numeros, con la comunicacion, 
    resolviendo problemas,o en trabajos manuales?
    3. Prefieres trabajar solo o en equipo? Estas mas interesado en trabajar en
    una oficina, o al aire libre? 
    4. Cual es tu nivel mas alto de estudios? tines algun certificado, entrenamiento o bootcamop?
    
    ANTES DE CONTESTAR, PORFAVOR PREGUNTA LAS 4 PREGUNTAS MENCIONADAS EN INGLES O ESPAÑOL SEGUN SEA EL CASO, y Usaras esta informacion para construir una respuesta y le brindaras la informacion pertinente
    la informacion debera ser breve concisa, porfavor PREGUNTA CADA UNA DE ESTAS PREGUNTAS, y ESPERA LA RESPUESTA DEL USUARIO y pensando en 3 medidas de tiempo, CORTO PLAZO, MEDIANO y LARGO PLAZO, enlistando al menos 2 objetivos por alcanzar en cada uno de estos moemntos antes mencionados
    Es decir que si el interesado tiene cierto gusto por el cine, la respuesta no debe SOLAMENTE incluir que trabaje en el cine, sino decirle como, y que objetivos perseguir para lograrlo.`;

    tokenCount += getTokens(prompt+originalPrompt);
    if (tokenCount > 4000) {
      return res.status(400).send("Message is too long");
    }

    const apiRequestBody: CreateChatCompletionRequest = {
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: prompt+originalPrompt }, ...requestMessages],
      temperature: 0.6,
    };
    const completion = await openai.createChatCompletion(apiRequestBody);

    res.json(completion.data);
  } catch (error) {
    if (error instanceof Error) {
      // @ts-ignore
      console.error(error);
    }
    res.status(500).send("Something went wrong");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
