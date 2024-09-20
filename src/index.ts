import Home from './index.html';

interface Env {
	DB: D1Database;
	INDEX: VectorizeIndex;
	AI: Ai;
}

type RequestBody = {
	query?: string;
};

const MODEL = '@cf/baai/bge-base-en-v1.5';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method === 'GET') {
			return new Response(Home, {
				headers: {
					'content-type': 'text/html',
				},
			});
		}

		if (request.method !== 'POST') {
			return Response.json('Method not allowed', { status: 405 });
		}

		const body: RequestBody = await request.json();
		if (!body.query) {
			return Response.json('Query is required', { status: 400 });
		}
		const query = body.query;

		const embeddings = await env.AI.run(MODEL, {
			text: query,
		}).catch((e) => console.error(e));
		if (!embeddings) {
			return Response.json('Something went wrong!', { status: 404 });
		}

		const { matches } = await env.INDEX.query(embeddings.data[0], {
			topK: 10,
		});
		if (matches.length === 0) {
			return Response.json('No matches found', { status: 404 });
		}

		const messages = await env.DB.prepare('SELECT MessageId, Contents FROM Customers WHERE MessageId IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
			.bind(...matches.map((match) => match.id))
			.all()
			.then((resp) => resp.results)
			.then((rows) =>
				rows.reduce((acc, row) => {
					acc[row.MessageId] = row.Contents;
					return acc;
				}, {})
			);

		const results = matches
			.sort((a, b) => a.score > b.score ? 1 : -1)
			.map((match) => ({
				question: messages[match.id],
				link: `https://chat.mozilla.org/#/room/!lrZtdjyLpBmoKbMdyx:mozilla.org/${match.id}`
			}));

		return Response.json(results, { status: 200 });
	},
} satisfies ExportedHandler<Env>;
