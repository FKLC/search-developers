# Search #developers

This is a very quick and dirty "search engine" for Firefox's #developers channel. It uses CloudFlare Workers. Could be extended to search other channels or even other documents.

## Implementation

[`data_in/`](data_in) contains the code to convert Element chat export to a JSON file that's compatible with the expected format in [`data_in/index.ts`](data_in/index.ts).

[`data_in/index.ts`](data_in/index.ts) creates text embeddings for each message using `@cf/baai/bge-base-en-v1.5` model, and inserts the embeddings with the message id to CloudFlare Vectorize.

[`src/index.ts`](src/index.ts) is the CloudFlare Worker that handles the search requests. It uses the same model to create embeddings for the query and searches for the closest messages in the Vectorize index. It then fetches the messages from D1 database and returns them.

<small>This is a very quick and dirty implementation. Please don't judge me.</small>