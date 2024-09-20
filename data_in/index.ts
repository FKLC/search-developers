import fs from 'node:fs/promises';

import config from './config.json' with { type: 'json' };

type EmbeddingsResponse = {
  result: {
    shape: [number, number];
    data: number[][];
  };
  "success": boolean;
  "errors": string[];
  "messages": string[];
}

type DataType = {
  documents: { [id: string]: string };
  metadata: {
    source: string;
    name: string;
  }
}

type VectorizeVector = {
  id: string;
  values: number[];
  metadata: {
    [key: string]: string
  }
}

async function getEmbeddings(text: string | string[]): Promise<EmbeddingsResponse> {
  return fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${config.model}`,
    {
      headers: { Authorization: `Bearer ${config.apiToken}` },
      method: "POST",
      body: JSON.stringify({ text }),
    }
  ).then((r) => r.json());
}

async function insertVectors(vectors: VectorizeVector[]) {
  const ndjson = vectors.map(v => JSON.stringify(v)).join("\n")
  const formData = new FormData();
  formData.append("vectors", new File([ndjson], "vectors.ndjson", { type: "application/x-ndjson" }));

  return fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/vectorize/v2/indexes/${config.indexName}/insert`,
    {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
      },
      method: "POST",
      body: formData
    }
  ).then((r) => r.json());
}

const MAX_TEXTS_PER_EMBEDDING_REQUEST = 100;
const SIMULTANEOUS_REQUESTS = 10;
const EMBEDDING_BATCH_SIZE = MAX_TEXTS_PER_EMBEDDING_REQUEST * SIMULTANEOUS_REQUESTS;

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

async function main() {
  console.log("Reading data from", process.argv[2]);
  const input = await fs.readFile(process.argv[2], 'utf-8');

  console.log("Parsing data");
  const data: DataType = JSON.parse(input);

  const ids = Object.keys(data.documents);
  const texts = Object.values(data.documents);
  const metadata = {
    source: `${data.metadata.source}:${data.metadata.name}`
  }

  const requestTexts = chunk(texts, MAX_TEXTS_PER_EMBEDDING_REQUEST);
  const simultaneousRequests = chunk(requestTexts, SIMULTANEOUS_REQUESTS);

  for (let i = 0; i < simultaneousRequests.length; i++) {
    const requests = simultaneousRequests[i];
    const embeddings = await Promise.all(requests.map((texts) => getEmbeddings(texts)))
      .then(responses => responses.map(r => {
        if (!r.success) {
          console.error("Error in response", r.errors, r.messages);
          return [];
        }
        return r.result.data;
      })).then(responses => responses.flat());

    const vectors: VectorizeVector[] = embeddings.map((values, j) => ({
      id: ids[i * EMBEDDING_BATCH_SIZE + j],
      values,
      metadata
    }));

    console.log("Inserting vectors", vectors.length);
    const insertResponse = await insertVectors(vectors);
    console.log("Insert response", insertResponse);

    console.log("Progress", i + 1, "/", simultaneousRequests.length);
  }
}

main()