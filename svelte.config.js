import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: '404.html',
			pages: 'build',
			assets: 'build',
			precompress: false,
			strict: false
		}),
		paths: {
			base: process.argv.includes('dev') ? '' : process.env.BASE_PATH || '/Docsie'
		}
	}
};

export default config;
