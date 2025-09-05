import { createClient } from '@sanity/client';

const client = createClient({
  projectId: '2dnm6wwp', // Your project ID
  dataset: 'butterfly-habits', // Replace with your dataset name (usually 'production')
  apiVersion: '2022-03-07', // Use the current date for API versioning
  useCdn: false, 
  token: process.env.REACT_APP_SANITY_TOKEN,
});
export default client;
